// utils.js

export const AJAX = {
    fetchWithCSRF,
    safeFetch,
    checkMultipartBinary,
    createHeaders,
    normalizeError,
    getResponseType,
    safelyReadResponse,
};

export const Forms = {
    formValidate,
    validateInputRegex,
    passwordStrengthRegex,
    togglePasswordVisibility,
    serializeForm,
    disableForm,
    formParser,
    objectContainsFile
};

export const Cookies = {
    getCookie,
    getCSRFToken,
    isCSRFTokenAvailable,
    StorageHelpers,
};

export const URLUtils = {
    URLHelpers,
    shareLinkSocialMedia,
    buildQuery,
    isURL,

};

export const UI = {
    ScrollHelpers,
    setCurrentDateTime,
    setElementLocked,
    toggleClass,
    showElement,
    hideElement,
    copyElementText,
    printSection,
};

export const Time = {
    nowTimestamp,
};

export const DOM = {
    domIsReady,
    waitForDomReady,
    safeGetElementById,
};

export const Utils = {
    debounce,
    throttle,
    generateId,
    deepClone,
    wait,
    isURL
};



/*========================================================= functions ==================================================*/


/**
 * Safe fetch wrapper with retry logic and timeout
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {Object} config - Configuration object
 * @param {boolean} config.autoJSON - Auto parse JSON response
 * @param {number} config.retries - Number of retry attempts
 * @param {number} config.timeout - Request timeout in ms
 * @returns {Promise<[Error|null, any]>} Tuple of error and data
 * 
 * safeFetch(url, options = {}, { retries = 0, timeout = 0, autoJSON = true })
 * 
 * - Auto JSON parsing (falls back to text if not JSON)
 * - Throws on non-OK responses (returns Error with err.status & err.data)
 * - Optional retries + timeout (AbortController)
 * - Returns [err, data] instead of try/catch
 * 
 * @example
 * const [err, data] = await safeFetch('/api/items', { method: 'POST', body: { name: 'Test' } }, { retries: 3, timeout: 5000 });
 * if (err) console.warn(`Error ${err.status}:`, err.data);
 */
async function safeFetch(url, options = {}, { autoJSON = true, retries = 0, timeout = 0 } = {}) {

    const controller = new AbortController();
    const id = timeout ? setTimeout(() => controller.abort(), timeout) : null;

    const opts = {
        ...options,
        signal: controller.signal,
        headers: {
            Accept: "application/json",
            ...(options.headers || {}),
        },
    };

    if (autoJSON && opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
        // do nothing if multipart or primitives
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(opts.body);
    }

    let attempts = 0;
    while (attempts <= retries) {
        try {
            const response = await fetch(url, opts);
            clearTimeout(id);

            const contentType = response.headers.get("content-type");
            let data = contentType?.includes("application/json")
                ? await response.json()
                : await response.text();

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return [null, data];
        } catch (err) {
            if (attempts < retries) {
                attempts++;
                continue; // retry
            }
            return [err, null];
        }
    }
}


/**
 * Parse a form element or plain object into a network-ready payload:
 * - Returns FormData if any file inputs exist.
 * - Returns JSON string otherwise (if autoJson = true).
 * - Returns plain object otherwise (if autoJson = false).
 * 
 * @example
 * const form = document.querySelector("#myForm");
 * const parsed = formParser(form);
 *
 * if (parsed instanceof FormData) {
 *   fetch("/api", { 
 *     method: "POST", 
 *     body: parsed 
 *   });
 * } else {
 *   fetch("/api", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(parsed)
 *   });
 * }
 */
function formParser(form, autoJson = true) {
    let dataObj;

    if (form instanceof HTMLFormElement) {
        dataObj = new FormData(form);
    } else if (typeof form === "object" && form !== null) {
        dataObj = form;
    } else {
        throw new Error("formParser expects a form element or a plain object");
    }

    // If it's already FormData, just return it
    if (dataObj instanceof FormData) {
        return dataObj;
    }

    // If object contains any file/blob, convert to FormData
    if (objectContainsFile(dataObj)) {
        const fd = new FormData();
        Object.entries(dataObj).forEach(([key, value]) => {
            if (value instanceof FileList) {
                Array.from(value).forEach(f => fd.append(key, f));
            } else {
                fd.append(key, value);
            }
        });
        return fd;
    }

    // Text-only object → return JSON string (default) or raw object
    return autoJson ? JSON.stringify(dataObj) : dataObj;
}



/**
 * Check if a value or object contains any File, Blob, or FileList.
 * 
 * This is useful when deciding whether to send data as JSON or
 * multipart/form-data in a fetch request.
 *
 * Usage:
 *   - Pass a JS object, FormData, or any value.
 *   - Returns `true` if any part of the object is a File/Blob/FileList.
 *   - Returns `false` for text-only data or empty objects.
 *
 * @param {*} obj - The value to inspect. Can be:
 *   - Plain JS object: { username: "alice", avatar: File }
 *   - FormData instance
 *   - File, Blob, FileList
 *   - Nested objects containing files
 * @returns {boolean} - `true` if the value contains any binary files, `false` otherwise.
 *
 * @example
 * objectContainsFile({ username: "alice" });               // false
 * objectContainsFile({ avatar: fileInput.files[0] });      // true
 * objectContainsFile(new FormData(form));                  // true if form has file inputs
 * objectContainsFile(fileInput.files);                     // true if non-empty FileList
 * objectContainsFile(null);                                // false
 */
function objectContainsFile(obj) {
    if (obj instanceof File || obj instanceof Blob) return true;
    if (obj instanceof FileList && obj.length > 0) return true;
    if (obj instanceof FormData) {
        for (const value of obj.values()) {
            if (containsFile(value)) return true;
        }
        return false;
    }
    if (typeof obj === "object" && obj !== null) {
        return Object.values(obj).some(containsFile);
    }
    return false; // primitives, null, undefined, etc.
}


/**
 * Infers the most appropriate response type from a Fetch API Response's Content-Type header.
 *
 * @function getResponseType
 * @param {Response} response - A Fetch API Response object.
 * @returns {"json"|"text"|"multipart"|"blob"|"unknown"} -
 *   A string describing the suggested response handler:
 *   - `"json"` → for `application/json`
 *   - `"text"` → for any `text/*` type
 *   - `"multipart"` → for `multipart/*` types (e.g., form-data, mixed)
 *   - `"blob"` → for binary types like `application/octet-stream`, `image/*`, `audio/*`, `video/*`, `application/pdf`
 *   - `"unknown"` → if the content type cannot be categorized
 *
 * @example
 * const response = await fetch("/api/data");
 * const type = getResponseType(response);
 *
 * switch (type) {
 *   case "json":
 *     const jsonData = await response.json();
 *     break;
 *   case "text":
 *     const textData = await response.text();
 *     break;
 *   case "blob":
 *     const blobData = await response.blob();
 *     break;
 *   case "multipart":
 *     // handle multipart parsing separately
 *     break;
 *   default:
 *     console.warn("Unknown response type");
 * }
 */
function getResponseType(response) {
  const contentType = (response.headers.get("Content-Type") || "").toLowerCase();

  if (contentType.includes("application/json")) return "json";
  if (contentType.startsWith("text/")) return "text";
  if (contentType.startsWith("multipart/")) return "multipart";
  if (
    contentType.includes("application/octet-stream") ||
    contentType.startsWith("image/") ||
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/") ||
    contentType.includes("application/pdf")
  ) {
    return "blob";
  }

  return "unknown";
}



/**
 * Safely reads a Fetch API Response by inferring the appropriate method from its Content-Type.
 *
 * @async
 * @function safelyReadResponse
 * @param {Response} response - A Fetch API Response object.
 * @returns {Promise<any>} The parsed response body:
 *   - `Object` (parsed JSON) if Content-Type is `application/json`
 *   - `string` if Content-Type is `text/*`
 *   - `Blob` if Content-Type suggests binary (`image/*`, `video/*`, `application/pdf`, etc.)
 *   - `string` (raw) if Content-Type is `multipart/*`
 *   - `ArrayBuffer` as a fallback for unknown types
 *
 * @description
 * Uses {@link getResponseType} to choose the correct method (`json`, `text`, `blob`, or `arrayBuffer`)
 * for reading a Fetch API response. Clones the response internally so the original
 * Response object remains usable if needed elsewhere.
 *
 * @example
 * const response = await fetch("/api/data");
 * const data = await safelyReadResponse(response);
 *
 * if (data instanceof Blob) {
 *   // Handle binary (e.g. download, preview, upload)
 * } else if (typeof data === "string") {
 *   // Handle text/multipart
 * } else if (typeof data === "object") {
 *   // Likely JSON
 * }
 */
async function safelyReadResponse(response) {
  const type = getResponseType(response);
  const clone = response.clone();

  switch (type) {
    case "json":
      return await clone.json();
    case "text":
      return await clone.text();
    case "blob":
      return await clone.blob();
    case "multipart":
      // return raw text for further parsing
      return await clone.text();
    default:
      // last-resort fallback
      return await clone.arrayBuffer();
  }
}


/**
 * Normalizes different error types (HTTP Response or standard JS Error) 
 * into a consistent object shape.
 *
 * @async
 * @function normalizeError
 * @param {any} error - The error to normalize. Can be a `Response`, `Error`, or unknown value.
 * @returns {Promise<Object>} A normalized error object:
 *   - For HTTP Response errors:
 *     { type: "http", status: number, statusText: string, url: string, body?: any }
 *   - For JS Errors:
 *     { type: "js", message: string, stack?: string }
 *   - For unknown values:
 *     { type: "unknown", value: any }
 *
 * @example
 * try {
 *   const res = await fetch("/api/fail");
 *   if (!res.ok) throw res;
 * } catch (err) {
 *   const normalized = await normalizeError(err);
 *   console.error(normalized);
 * }
 */
async function normalizeError(error) {
  if (error instanceof Response) {
    let body;
    try {
      // Try to parse JSON body if available
      const clone = error.clone();
      body = await clone.json().catch(() => clone.text());
    } catch {
      body = null;
    }
    return {
      type: "http",
      status: error.status,
      statusText: error.statusText || "",
      url: error.url,
      body,
    };
  }

  if (error instanceof Error) {
    return {
      type: "js",
      message: error.message || "Unknown error",
      stack: error.stack,
    };
  }

  return {
    type: "unknown",
    value: error,
  };
}


/**
 * Creates a Headers object with sensible defaults for JSON APIs and optional auth.
 *
 * @function createHeaders
 * @param {Object} [options={}] - Configuration options.
 * @param {boolean} [options.isJson=true] - Whether to set `Content-Type: application/json`.
 * @param {string|null} [options.token=null] - Bearer token for `Authorization` header.
 * @param {Record<string,string>} [options.extra={}] - Additional headers to include or override.
 * @returns {Headers} A Fetch API Headers object.
 *
 * @example
 * // JSON + Authorization
 * const headers = createHeaders({ token: "abc123" });
 * 
 * // Custom headers
 * const headers = createHeaders({ 
 *   isJson: false, 
 *   extra: { "X-Client": "my-app" } 
 * });
 *
 * fetch("/api/data", { headers });
 */
function createHeaders({ isJson = true, token = null, extra = {} } = {}) {
  const headers = new Headers();

  if (isJson && !extra["Content-Type"]) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }

  return headers;
}




/*
@example
const params = { search: "query", page: 2 };
const queryString = buildQuery(params);
// Result: "search=query&page=2"
*/
function buildQuery(params = {}) {
  return new URLSearchParams(params).toString();
}





/**
 * Checks if a Fetch API Response is multipart and whether it contains binary data.
 *
 * @async
 * @function checkMultipartBinary
 * @param {Response} response - A Fetch API Response object to inspect.
 * @returns {Promise<Object>} An object with the following properties:
 *   @property {boolean} isMultipart - True if the response has a multipart Content-Type.
 *   @property {boolean} isBinary - True if the multipart body appears to contain binary data
 *     (any non-text/non-JSON type with nonzero size).
 *   @property {Blob|null} blob - A Blob copy of the response body (if multipart), otherwise null.
 *
 * @description
 * This function inspects the Content-Type header of a response to determine if it is multipart.
 * If multipart, it clones the response and reads the body as a Blob so that the original response
 * stream remains available for further processing. The blob type is checked to decide whether the
 * content is likely binary (e.g., `application/octet-stream`, images, PDFs).
 *
 * Note: This does **not** parse multipart boundaries or inspect individual parts; it only provides
 * a coarse check on the overall response payload.
 *
 * @example
 * const response = await fetch("/api/download");
 * const result = await checkMultipartBinary(response);
 *
 * if (result.isMultipart && result.isBinary) {
 *   // Handle binary multipart response
 *   const fileBlob = result.blob;
 *   // e.g., download, preview, or parse
 * } else {
 *   // Handle as normal JSON/text
 *   const data = await response.json();
 * }
 */
async function checkMultipartBinary(response) {
    const contentType = response.headers.get("Content-Type");

    if (contentType && contentType.startsWith("multipart/")) {
        console.log("Response is multipart");

        // Clone to avoid consuming the original response body
        const blob = await response.clone().blob();

        // More robust binary check
        const isBinary = !/^text\/|application\/json/.test(blob.type) && blob.size > 0;

        console.log(
            isBinary
                ? "Response contains binary data"
                : "Response is multipart but not binary"
        );

        return { isMultipart: true, isBinary, blob };
    }

    console.log("Response is not multipart");
    return { isMultipart: false, isBinary: false, blob: null };
}




function disableForm(form, state = true) {
    [...form.elements].forEach(el => el.disabled = state);
}



function toggleClass(element, className) {
    try {
        element.classList.toggle(className);
    } catch (error) {
        console.error(error.message);
    }
}

function showElement(element) {
    if (element) el.style.display = '';
}
function hideElement(element) {
    if (element) el.style.display = 'none';
}


async function copyElementText(element) {
    if (!element) {
        console.error(`[copyElementText] Element not found.`);
        return false;
    }

    const text = element.textContent || element.innerText;
    if (!text) {
        console.error(`[copyElementText] Element has no text content to copy.`);
        return false;
    }

    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false;
    }
}



function debounce(func, wait, options = {}) {
    const { immediate = false, maxWait } = options;
    let timeoutId, lastCallTime, result;

    const later = (context, args) => {
        const timeSinceLastCall = Date.now() - lastCallTime;

        if (maxWait && timeSinceLastCall < maxWait) {
            timeoutId = setTimeout(() => later(context, args), wait);
        } else {
            timeoutId = null;
            if (!immediate) result = func.apply(context, args);
        }
    };

    return function debounced(...args) {
        const context = this;
        const callNow = immediate && !timeoutId;

        clearTimeout(timeoutId);
        lastCallTime = Date.now();

        if (callNow) {
            result = func.apply(context, args);
        } else if (!timeoutId && maxWait) {
            timeoutId = setTimeout(() => later(context, args), wait);
        } else {
            timeoutId = setTimeout(() => later(context, args), wait);
        }

        return result;
    };
}


function domIsReady() {
    return document.readyState === 'complete' || document.readyState === 'interactive';
}


function shareLinkSocialMedia(platform, url, text = '', hashtags = '') {
    let shareUrl = '';
    switch (platform) {
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}&hashtags=${encodeURIComponent(hashtags)}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            break;
        case 'whatsapp':
            shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}%20${encodeURIComponent(url)}`;
            break;
        case 'telegram':
            shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
            break;
        case 'reddit':
            shareUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
            break;
        case 'pinterest':
            shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}`;
            break;
        case 'email':
            shareUrl = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`;
            break;
        default:
            console.error('Unsupported social media platform:', platform);
            return;
    }
    // Open the share URL in a new window
    window.open(shareUrl, '_blank', 'width=600,height=400');
}


function waitForDomReady() {
    return new Promise(resolve => {
        if (domIsReady()) {
            resolve();
        }
        else {
            document.addEventListener('DOMContentLoaded', resolve);
        }
    });
}

function setElementLocked(el, isDisabled = true) {
    if (!el) {
        console.warn("[setElementLocked] Target element not found.");
        return null; // return null to signal no action
    }

    const isAlreadyDisabled = el.hasAttribute("disabled");

    if (isDisabled) {
        if (isAlreadyDisabled) return true; // ! already locked
        el.setAttribute("disabled", "true");
        el.classList.add("is-locked");
        return false; // ! just locked now
    } else {
        el.removeAttribute("disabled");
        el.classList.remove("is-locked");
        return true; //  * just unlocked now
    }
}



function setCurrentDateTime(el, format = 'YYYY-MM-DD HH:mm:ss', mode = 'text') {
    if (!el) {
        console.warn("[setCurrentDateTime] Target element not found.");
        return null;
    }

    const now = new Date();

    // Lightweight formatter
    const pad = (n) => String(n).padStart(2, '0');
    const formattedDate = format
        .replace('YYYY', now.getFullYear())
        .replace('MM', pad(now.getMonth() + 1))
        .replace('DD', pad(now.getDate()))
        .replace('HH', pad(now.getHours()))
        .replace('mm', pad(now.getMinutes()))
        .replace('ss', pad(now.getSeconds()));

    const isoString = now.toISOString();
    const readable = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    // Apply mode safely
    switch (mode) {
        case 'text':
            el.textContent = formattedDate;
            break;
        case 'value':
            if ('value' in el) el.value = formattedDate;
            else console.warn('[setCurrentDateTime] Element does not support value property.');
            break;
        case 'both':
            el.textContent = formattedDate;
            if ('value' in el) el.value = formattedDate;
            break;
        default:
            console.warn(`[setCurrentDateTime] Unknown mode "${mode}", defaulting to text.`);
            el.textContent = formattedDate;
    }

    // Set attributes for semantic info
    el.setAttribute('datetime', isoString);
    el.setAttribute('data-format', format);
    el.setAttribute('title', readable);
    el.classList.add('current-datetime');

    return formattedDate;
}



function formValidate(form) {
    if (!form || !(form instanceof HTMLFormElement)) {
        console.error('Invalid form element provided for validation.');
        return false;
    }
    const inputs = form.querySelectorAll('input, select, textarea');

    function validateGenericInput(input) {
        if (input.checkValidity()) {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
        } else {
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
        }
    }

    inputs.forEach(input => {
        input.addEventListener('input', function () {
            validateGenericInput(input);
        });
        input.addEventListener('blur', function () {
            input.dispatchEvent(new Event('input'));
        });
    });
}


function passwordStrengthRegex(password, regex) {
    /** can be used along css classes */
    if (!password || typeof password !== 'string') {
        console.error('Invalid password provided for strength validation.');
        return false;
    }
    if (!regex || !(regex instanceof RegExp)) {
        regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/; // Default regex for strong password
    }

    return regex.test(password);
}


function togglePasswordVisibility(inputEl, togglerEl) {

    if (!inputEl || !toggleButtonEl) {
        console.error('[togglePasswordVisibility] Target elements not found.');
        return;
    }

    togglerEl.addEventListener('click', function () {
        if (inputEl.type === 'password') {
            inputEl.type = 'text';
            togglerEl.innerHTML = "<i class='fa fa-eye'></i>";
        } else {
            inputEl.type = 'password';
            togglerEl.innerHTML = "<i class='fa fa-eye-slash'></i>";
        }
    });
}


function nowTimestamp({ includeDate = false, format = null } = {}) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    if (format) {
        return format
            .replace('YYYY', now.getFullYear())
            .replace('MM', pad(now.getMonth() + 1))
            .replace('DD', pad(now.getDate()))
            .replace('HH', pad(now.getHours()))
            .replace('mm', pad(now.getMinutes()))
            .replace('ss', pad(now.getSeconds()));
    }

    // Default behavior
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (!includeDate) return time;

    const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    return `${date} ${time}`;
}



function validateInputRegex(inputEl, regex) {
    if (!inputEl || !(inputEl instanceof HTMLInputElement)) {
        console.error('Invalid input element provided for regex validation.');
        return false;
    }
    if (!regex || !(regex instanceof RegExp)) {
        console.error('Invalid regex provided for validation.');
        return false;
    }

    inputEl.addEventListener('input', function () {
        if (regex.test(inputEl.value)) {
            inputEl.classList.remove('is-invalid');
            inputEl.classList.add('is-valid');
        } else {
            inputEl.classList.remove('is-valid');
            inputEl.classList.add('is-invalid');
        }
    });
    inputEl.addEventListener('blur', function () {
        inputEl.dispatchEvent(new Event('input'));
    });
}

function getCookie(name) {
    if (!document.cookie) return null;

    return document.cookie
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith(`${name}=`))
        ?.split('=')[1]
        ?.replace(/^"+|"+$/g, '')
        ?? null;
}


const getCSRFToken = (() => {
    let cachedToken = null;

    return () => {
        // Return cached value if available
        if (cachedToken) return cachedToken;

        // 1. Look for hidden input
        const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
        if (input && input.value) {
            cachedToken = input.value;
            return cachedToken;
        }

        // 2. Look for <meta name="csrf-token" content="...">
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta && meta.content) {
            cachedToken = meta.content;
            return cachedToken;
        }

        // 3. Look for CSRF cookie (if not HttpOnly)
        const cookieToken = getCookie('csrftoken');
        if (cookieToken) {
            cachedToken = cookieToken;
            return cachedToken;
        }
        else {
            console.warn('[CSRF] Token not found in DOM input, meta, or cookies.');
            return null;
        }

    };
})();



async function fetchWithCSRF(url, options = {}) {
    const csrfToken = getCSRFToken();
    const headers = {
        "X-CSRFToken": csrfToken,
        ...(options.headers || {}),
    };

    return safeFetch(
        url,
        {
            ...options,
            headers,
            method: options.method || "POST",
        },
        { autoJSON: true }
    );
}


function serializeForm(form, { asJSON = false } = {}) {
    if (!(form instanceof HTMLFormElement)) {
        console.error("serializeForm: provided element is not a form.");
        return asJSON ? '{}' : {};
    }

    const serialized = [...new FormData(form).entries()].reduce((acc, [key, value]) => {
        if (key in acc) {
            if (!Array.isArray(acc[key])) acc[key] = [acc[key]];
            acc[key].push(value);
        } else {
            acc[key] = value;
        }
        return acc;
    }, {});

    return asJSON ? JSON.stringify(serialized) : serialized;
}

const URLHelpers = {
    getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    setQueryParam(param, value) {
        const urlParams = new URLSearchParams(window.location.search);
        if (value === null || value === undefined) {
            urlParams.delete(param);
        } else {
            urlParams.set(param, value);
        }
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.history.pushState({}, '', newUrl);
    },

    removeQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.delete(param);
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.history.pushState({}, '', newUrl);
    },

    getCurrentUrl() {
        return window.location.href;
    },

    setCurrentUrl(url) {
        if (url) {
            window.history.pushState({}, '', url);
        } else {
            console.warn('Invalid URL provided to setCurrentUrl.');
        }
    }
};




function isCSRFTokenAvailable() {
    return !!getCSRFToken() || !!getCookie('csrftoken');
}



const ScrollHelpers = {
    _validateBehavior(behavior) {
        if (['instant', 'smooth', 'auto'].includes(behavior)) return behavior;
        console.warn('Invalid scroll behavior specified. Defaulting to "instant".');
        return 'instant';
    },

    preserveScrollPos(behavior = 'instant', offset = 0) {
        behavior = this._validateBehavior(behavior);
        offset = parseInt(offset, 10) || 0;

        const savedScrollPosition = localStorage.getItem('currentScrollPos');
        if (savedScrollPosition !== null) {
            window.scrollTo({
                top: Math.max(0, parseInt(savedScrollPosition, 10)) + offset,
                behavior
            });
            localStorage.removeItem('currentScrollPos');
        }

        document.addEventListener('scroll', () => {
            const adjustedScroll = Math.max(0, window.scrollY);
            localStorage.setItem('currentScrollPos', adjustedScroll);
        });
    },

    scrollToTop(behavior = 'instant', offset = 0) {
        behavior = this._validateBehavior(behavior);
        offset = parseInt(offset, 10) || 0;

        window.scrollTo({
            top: 0 + offset,
            behavior
        });
    },

    scrollToBottom(behavior = 'instant') {
        behavior = this._validateBehavior(behavior);

        window.scrollTo({
            top: document.body.scrollHeight,
            behavior
        });
    },

    scrollToElement(element, behavior = 'instant') {
        behavior = this._validateBehavior(behavior);

        if (element) {
            element.scrollIntoView({
                behavior,
                block: 'start'
            });
        } else {
            console.warn(`[scrollToElement] Element not found.`);
        }
    }
};



/**
 * Print a specific section of the page with custom options.
 * @param {Object} options
 * @param {string} options.sectionSelector - CSS selector for the section to print (required)
 * @param {string[]} [options.hideSelectors] - Array of selectors to hide during print
 * @param {string} [options.watermarkSelector] - Selector for watermark to show during print
 * @param {string} [options.extraPrintCSS] - Additional CSS to inject for print
 */
function printSection({ sectionSelector, hideSelectors = [], watermarkSelector = null, extraPrintCSS = '' }) {

    /** Usage example: 
        document.getElementById('download-pdf-button')?.addEventListener('click', function () {
            printSection({
                sectionSelector: '#product-detail-section',
                hideSelectors: ['#base-nav', '#product-detail-buttons', '#similar-products-section', 'footer'],
                watermarkSelector: '#water-mark-logo',
                extraPrintCSS: '' // Optional extra CSS
            });
        }); 
    */

    if (!sectionSelector) {
        console.error('printSection: sectionSelector is required.');
        return;
    }

    let hideCSS = '';
    if (hideSelectors.length) {
        hideCSS = `${hideSelectors.join(', ')} { display: none !important; }`;
    }
    let watermarkCSS = '';
    if (watermarkSelector) {
        watermarkCSS = `${watermarkSelector} { display: block !important; }`;
    }

    const style = document.createElement('style');
    style.innerHTML = `
        @media print {
            body * { visibility: hidden !important; }
            ${sectionSelector}, ${sectionSelector} * { visibility: visible !important; }
            ${hideCSS}
            ${watermarkCSS}
            ${extraPrintCSS}
        }
    `;
    document.head.appendChild(style);

    const cleanup = () => {
        document.head.removeChild(style);
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();
}



function throttle(func, limit) {
    /*
    execute a function at most once every limit milliseconds.
    example : window.addEventListener('scroll', throttle(logScroll, 500));
    */
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}


function deepClone(obj) {
    // in case structuredClone might not be supported
    if (typeof structuredClone === "function") {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
}

function generateId(prefix = '') {
    return prefix + Math.random().toString(36).slice(2, 11);
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



function safeGetElementById(id, context = document) {
    const el = context.getElementById(id);
    if (!el) {
        throw new Error(`Element with ID "${id}" not found`);
    }
    return el;
}


const StorageHelpers = {
    get(key, defaultValue = null, useSession = false) {
        const store = useSession ? sessionStorage : localStorage;
        try {
            const item = store.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn(`[Storage] Failed to parse item: ${key}`, e);
            return defaultValue;
        }
    },

    set(key, value, useSession = false) {
        const store = useSession ? sessionStorage : localStorage;
        try {
            store.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`[Storage] Failed to set item: ${key}`, e);
            return false;
        }
    },

    remove(key, useSession = false) {
        const store = useSession ? sessionStorage : localStorage;
        try {
            store.removeItem(key);
            return true;
        } catch (e) {
            console.error(`[Storage] Failed to remove item: ${key}`, e);
            return false;
        }
    },

    exists(key, useSession = false) {
        const store = useSession ? sessionStorage : localStorage;
        return store.getItem(key) !== null;
    }
};

function isURL(str) {
    const pattern = new RegExp(`^((ft|htt)ps?:\\/\\/)?` + // protocol
        `((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|` + // domain name and extension
        `((\\d{1,3}\\.){3}\\d{1,3}))` + // OR ip (v4) address
        `(\\:\\d+)?` + // port
        `(\\/[-a-z\\d%@_.~+&:]*)*` + // path
        `(\\?[;&a-z\\d%@_.,~+&:=-]*)?` + // query string
        `(\\#[-a-z\\d_]*)?$`, `i`); // fragment locator
    return pattern.test(str);
}