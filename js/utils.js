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
};

export const Cookies = {
    getCookie,
    getCSRFToken,
    isCSRFTokenAvailable,
};

export const URLUtils = {
    getQueryParam,
    setQueryParam,
    removeQueryParam,
    getCurrentUrl,
    setCurrentUrl,
    shareLinkSocialMedia,
};

export const UI = {
    preserveScrollPos,
    scrollToTop,
    scrollToElementById,
    scrollToBottom,
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
};

export const Utils = {
    debounce,
    throttle,
    generateId,
    deepClone,
};



/*========================================================= functions ==================================================*/

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



function disableForm(form, state = true) {
    [...form.elements].forEach(el => el.disabled = state);
}



function toggleClass(elementId, className) {
    const el = document.getElementById(elementId);
    if (el) el.classList.toggle(className);
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


function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };

        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) func.apply(this, args);
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

function setElementLocked(elementId, is_disabled) {
    const el = document.getElementById(elementId);
    if (!el) {
        console.warn(`Element with ID "${elementId}" not found.`);
        return;
    }

    const alreadyLocked = el.getAttribute('data-locked') === 'true';

    if (is_disabled) {
        if (alreadyLocked) return true; // ! It's already locked
        el.setAttribute('disabled', 'true');
        el.setAttribute('data-locked', 'true');
        el.classList.add('is-locked');
        el.style.pointerEvents = 'none';
        el.style.opacity = 0.6;
        return false; // ! Just locked now
    } else {
        // * element is unlocked
        el.removeAttribute('disabled');
        el.removeAttribute('data-locked');
        el.classList.remove('is-locked');
        el.style.pointerEvents = 'auto';
        el.style.opacity = 1;
        return false;
    }
}





function setCurrentDateTime(elementId, format = 'YYYY-MM-DD HH:mm:ss', mode = 'text') {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with ID "${elementId}" not found.`);
        return;
    }

    const now = new Date();

    // Custom date formatter (simple fallback)
    function formatDate(date, format) {
        const pad = (n) => String(n).padStart(2, '0');
        return format
            .replace('YYYY', date.getFullYear())
            .replace('MM', pad(date.getMonth() + 1))
            .replace('DD', pad(date.getDate()))
            .replace('HH', pad(date.getHours()))
            .replace('mm', pad(date.getMinutes()))
            .replace('ss', pad(date.getSeconds()));
    }

    const formattedDate = formatDate(now, format);
    const isoString = now.toISOString();
    const readable = now.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    });

    // Set content based on mode
    if (mode === 'text') {
        element.textContent = formattedDate;
    } else if (mode === 'value') {
        element.value = formattedDate;
    } else {
        element.textContent = formattedDate;
        element.value = formattedDate;
    }

    element.setAttribute('datetime', isoString);
    element.setAttribute('data-format', format);
    element.setAttribute('title', readable);
    element.classList.add('current-datetime');
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


function togglePasswordVisibility(inputId, toggleButtonId) {
    const input = document.getElementById(inputId);
    const toggleButton = document.getElementById(toggleButtonId);

    if (!input || !toggleButton) {
        console.error('Invalid input or toggle button ID provided.');
        return;
    }

    toggleButton.addEventListener('click', function () {
        if (input.type === 'password') {
            input.type = 'text';
            toggleButton.innerHTML = "<i class='fa fa-eye'></i>";
        } else {
            input.type = 'password';
            toggleButton.innerHTML = "<i class='fa fa-eye-slash'></i>";
        }
    });
}


function nowTimestamp({ includeDate = false } = {}) {
    const now = new Date();

    const pad = (n) => n.toString().padStart(2, '0');

    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());

    const time = `${hours}:${minutes}`;

    if (!includeDate) return time;

    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1); // Months are 0-based
    const year = now.getFullYear();

    const date = `${day}/${month}/${year}`;

    return `${date} ${time}`;
}



function validateInputRegex(input, regex) {
    if (!input || !(input instanceof HTMLInputElement)) {
        console.error('Invalid input element provided for regex validation.');
        return false;
    }
    if (!regex || !(regex instanceof RegExp)) {
        console.error('Invalid regex provided for validation.');
        return false;
    }

    input.addEventListener('input', function () {
        if (regex.test(input.value)) {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
        } else {
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
        }
    });
    input.addEventListener('blur', function () {
        input.dispatchEvent(new Event('input'));
    });
}

function getCookie(name) {
    /** only if django HTTPONLY cookie setting is false */
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Check if this cookie string begins with the name we want
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}


const getCSRFToken = (() => {
    let cachedToken = null;
    return () => {
        if (cachedToken) return cachedToken;

        const input = document.querySelector('[name=csrfmiddlewaretoken]');
        if (input?.value) {
            cachedToken = input.value;
            return cachedToken;
        }

        const meta = document.querySelector('meta[name="csrf-token"]');
        cachedToken = meta ? meta.getAttribute('content') : null;
        return cachedToken;
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


function serializeForm(form) {
    const formData = new FormData(form);
    const serialized = {};
    for (const [key, value] of formData.entries()) {
        if (serialized.hasOwnProperty(key)) {
            // If the key already exists, convert it to an array
            if (!Array.isArray(serialized[key])) {
                serialized[key] = [serialized[key]];
            }
            serialized[key].push(value);
        } else {
            serialized[key] = value;
        }
    }
    return serialized;
}


function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}


function setQueryParam(param, value) {
    const urlParams = new URLSearchParams(window.location.search);
    if (value === null || value === undefined) {
        urlParams.delete(param);
    } else {
        urlParams.set(param, value);
    }
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.pushState({}, '', newUrl);
}


function removeQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete(param);
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.pushState({}, '', newUrl);
}


function getCurrentUrl() {
    return window.location.href;
}


function setCurrentUrl(url) {
    if (url) {
        window.history.pushState({}, '', url);
    } else {
        console.warn('Invalid URL provided to setCurrentUrl.');
    }
}




function isCSRFTokenAvailable() {
    return !!getCSRFToken() || !!getCookie('csrftoken');
}



function preserveScrollPos(behavior = 'instant', offset = 0) {
    if (behavior !== 'instant' && behavior !== 'smooth' && behavior !== 'auto') {
        // If an invalid behavior is specified, default to 'instant'
        console.warn('Invalid behavior specified. Defaulting to "instant".');
        behavior = 'instant';
    }

    offset = parseInt(offset, 10) || 0; // Ensure offset is a number
    const savedScrollPosition = localStorage.getItem('currentScrollPos');


    if (savedScrollPosition !== null) {
        window.scrollTo({
            top: Math.max(0, parseInt(savedScrollPosition, 10)) + offset, // Ensure non-negative value and apply offset
            behavior: behavior
        });
        localStorage.removeItem('currentScrollPos'); // Clear after use
    }

    document.addEventListener('scroll', function () {
        const adjustedScroll = Math.max(0, window.scrollY); // Ensure non-negative value
        localStorage.setItem('currentScrollPos', adjustedScroll);
    });
}


function scrollToTop(behavior = 'instant', offset = 0) {
    if (behavior !== 'instant' && behavior !== 'smooth' && behavior !== 'auto') {
        // If an invalid behavior is specified, default to 'instant'
        console.warn('Invalid behavior specified. Defaulting to "instant".');
        behavior = 'instant';
    }

    offset = parseInt(offset, 10) || 0; // Ensure offset is a number

    window.scrollTo({
        top: 0 + offset, // Add offset to the top position
        behavior: 'smooth'
    });
}



function scrollToElementById(elementId, behavior = 'instant') {
    if (behavior !== 'instant' && behavior !== 'smooth' && behavior !== 'auto') {
        // If an invalid behavior is specified, default to 'instant'
        console.warn('Invalid behavior specified. Defaulting to "instant".');
        behavior = 'instant';
    }
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({
            behavior: behavior,
            block: 'start'
        });
    } else {
        console.warn(`Element with ID ${elementId} not found.`);
    }
}



function scrollToBottom(behavior = 'instant') {
    if (behavior !== 'instant' && behavior !== 'smooth' && behavior !== 'auto') {
        // If an invalid behavior is specified, default to 'instant'
        console.warn('Invalid behavior specified. Defaulting to "instant".');
        behavior = 'instant';
    }
    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: behavior
    });
}




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


// Throttle function
function throttle(func, limit) {
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
