// utils.js

export const AJAX = {
    fetchWithCSRF,
    safeFetch,
};

export const Forms = {
    formValidate,
    validateInputRegex,
    passwordStrengthRegex,
    togglePasswordVisibility,
    serializeForm,
    disableForm,
    formParser,
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
 */
async function safeFetch(url, options = {}, { autoJSON = true, retries = 0, timeout = 0 } = {}) {
    /*
    * safeFetch(url, options = {}, { retries = 0, timeout = 0, autoJSON = true })
    * 
    * - Auto JSON parsing (falls back to text if not JSON)
    * - Throws on non-OK responses (returns Error with err.status & err.data)
    * - Optional retries + timeout (AbortController)
    * - Returns [err, data] instead of try/catch
    *
    * Example:
    * const [err, data] = await safeFetch('/api/items', { method: 'POST', body: { name: 'Test' } }, { retries: 3, timeout: 5000 });
    * if (err) console.warn(`Error ${err.status}:`, err.data);
    */

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
 * formParser(form)
 * @param {HTMLFormElement|Object} input - A form element or plain object
 * @returns {FormData|Object} - FormData if files exist, otherwise plain object
 */
function formParser(form) {
    /**
     * 
     * Usage: 
        const form = document.querySelector("#myForm");
        const parsed = formParser(form);

        if (parsed instanceof FormData) {
        fetch("/api", { 
        method: "POST", 
        headers: { "Content-Type": "multipart/form-data" },
        body: parsed 
        });
        
        } else {
        fetch("/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed)
        });
        }

    */
  let dataObj;

  if (form instanceof HTMLFormElement) {
    dataObj = new FormData(form);
  } else if (typeof form === "object" && form !== null) {
    dataObj = form;
  } else {
    throw new Error("formParser expects a form element or an object");
  }

  // Helper to detect files
  function containsFile(val) {
    if (val instanceof File || val instanceof Blob) return true;
    if (val instanceof FileList && val.length > 0) return true;
    if (val instanceof FormData) {
      for (const value of val.values()) {
        if (containsFile(value)) return true;
      }
      return false;
    }
    if (typeof val === "object" && val !== null) {
      return Object.values(val).some(containsFile);
    }
    return false;
  }

  // If it's FormData, check if any value is a file
  if (dataObj instanceof FormData) {
    return dataObj; // already FormData, browser handles files automatically
  }

  // Plain object with files → convert to FormData
  if (containsFile(dataObj)) {
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

  // Text-only object → return as-is (ready for JSON)
  return dataObj;
}



function disableForm(form, state = true) {
    [...form.elements].forEach(el => el.disabled = state);
}



function toggleClass(elementId, className) {
    try {
        const el = document.getElementById(elementId);
        el.classList.toggle(className);
    } catch (error) {
        console.error(error.message);
    }
}

function showElement(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = '';
}
function hideElement(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
}


async function copyElementText(elementId) {
    const el = document.getElementById(elementId);
    if (!el) {
        console.error(`Element with ID "${elementId}" not found.`);
        return false;
    }

    const text = el.textContent || el.innerText;
    if (!text) {
        console.error(`Element with ID "${elementId}" has no text content to copy.`);
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