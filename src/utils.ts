import { HttpRequestParams } from './interface';
import { IncomingMessage, RequestOptions } from 'http';
import { Errors, GOOD_RESPONSE_STATUS_CODE } from './const';
import { request } from 'https';
import HttpsProxyAgent from 'https-proxy-agent';

export function httpRequest({ hostname, port, path, json, proxy, method, params }: HttpRequestParams): Promise<string | any> {
  return new Promise(async (res, rej) => {
    // @ts-ignore
    const stringedParams = Object.keys(params || {}).map(i => `${ i }=${ params[ i ] }`).join('&');
    if (stringedParams) {
      path = `${ path }?${ stringedParams }`;
    }
    const options: RequestOptions = {
      hostname,
      port,
      method,
      path,
    };
    let data = '';

    if (proxy) {
      options.agent = HttpsProxyAgent(proxy);
    }

    const req = request(options, (response: IncomingMessage) => {
      if (response.statusCode === GOOD_RESPONSE_STATUS_CODE) {
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          if (json) {
            try {
              data = JSON.parse(data);
            } catch (e) {
              throw new Error(`${ Errors.PARSING_ERROR }: ${ e }`);
            }
          }
          res(data);
        });
      } else {
        rej({ statusCode: response.statusCode, message: response.statusMessage });
      }
    });

    req.on('error', (e) => {
      rej(e);
    });

    req.end();
  });
}

export function parseSteamCommunityItemPage(page: string, regEx: RegExp) {
  return page.match(regEx);
}

export function parsePriceHistory(data: string) {
  try {
    return JSON.parse(`[${ data }]`);
  } catch (e) {
    throw new Error(`${ Errors.PRICE_HISTORY_PARSE_ERROR }: ${ e }`);
  }
}

export function parseMarketData(page: string) {
  const result: any = {
    itemNameId: { value: '', regExp: /Market_LoadOrderSpread\((.*[0-9]?)\)/ },
    priceHistory: { value: '', regExp: /var line1=\[(.*)\]/ },
    icon: { value: '', regExp: /https\:\/\/.*\/economy\/image\/(.*)\// },
  };

  Object.keys(result).forEach((key) => {
    try {
      result[ key ].value = (parseSteamCommunityItemPage(page, result[ key ].regExp) || [])[ 1 ];
    } catch (e) {
      throw new Error(`${ Errors.PAGE_PARSING_ERROR } - ${ key }: ${ e }`);
    }
  });

  return {
    itemNameId: result.itemNameId.value && Number(result.itemNameId.value),
    icon: result.icon.value,
    priceHistory: result.priceHistory.value && parsePriceHistory(result.priceHistory.value),
  };
}
