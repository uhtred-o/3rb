import * as cheerio from 'cheerio';
import { Logger } from './logger.js';

const logger = new Logger('HttpClient');

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  referer?: string;
  cookies?: string;
  timeout?: number;
  body?: any;
  method?: 'GET' | 'POST' | 'HEAD';
  form?: Record<string, string>;
  redirect?: 'follow' | 'manual' | 'error';
}

export interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  text: string;
  json: () => T;
  $: cheerio.CheerioAPI;
}

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export class HttpClient {
  private defaultHeaders: Record<string, string>;
  private cookieJar: Map<string, string> = new Map();

  constructor(defaultHeaders: Record<string, string> = {}) {
    this.defaultHeaders = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      ...defaultHeaders,
    };
  }

  setCookie(key: string, value: string) {
    this.cookieJar.set(key, value);
  }

  getCookieString(): string {
    const parts: string[] = [];
    this.cookieJar.forEach((val, key) => {
      parts.push(`${key}=${val}`);
    });
    return parts.join('; ');
  }

  async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeout = options.timeout || 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options.headers || {}),
    };

    if (options.referer) {
      headers['Referer'] = options.referer;
    }

    const cookieHeader = [this.getCookieString(), options.cookies].filter(Boolean).join('; ');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    let body: BodyInit | undefined = undefined;
    const method = options.method || (options.form || options.body ? 'POST' : 'GET');

    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.form)) {
        searchParams.append(key, value);
      }
      body = searchParams.toString();
    } else if (options.body) {
      if (typeof options.body === 'object' && !(options.body instanceof String)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = JSON.stringify(options.body);
      } else {
        body = String(options.body);
      }
    }

    try {
      const resp = await fetch(url, {
        method,
        headers,
        body,
        redirect: options.redirect || 'follow',
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      resp.headers.forEach((val, key) => {
        responseHeaders[key.toLowerCase()] = val;
      });

      // Track set-cookie
      const setCookie = resp.headers.get('set-cookie');
      if (setCookie) {
        const matches = setCookie.matchAll(/([^=;]+)=([^;]+)/g);
        for (const match of matches) {
          const k = match[1]?.trim();
          const v = match[2]?.trim();
          if (k && v && !['path', 'expires', 'domain', 'samesite', 'secure', 'httponly'].includes(k.toLowerCase())) {
            this.cookieJar.set(k, v);
          }
        }
      }

      const text = await resp.text();

      return {
        status: resp.status,
        statusText: resp.statusText,
        url: resp.url,
        headers: responseHeaders,
        text,
        json: () => {
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error(`Failed to parse JSON response: ${(e as Error).message}`);
          }
        },
        $: cheerio.load(text),
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T = any>(url: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST' });
  }
}

export const http = new HttpClient();
