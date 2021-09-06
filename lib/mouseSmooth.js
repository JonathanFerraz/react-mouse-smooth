function MouseSmooth({ time = 800, size = 100, keyboardSupport = true }) {
  let defaultOptions = {
    frameRate: 150, // [Hz]
    animationTime: time, // [ms]
    stepSize: size, // [px]
    pulseAlgorithm: true,
    pulseScale: 5,
    pulseNormalize: 1,
    accelerationDelta: 50, // 50
    accelerationMax: 3, // 3
    keyboardSupport: keyboardSupport, // option
    arrowScroll: 50, // [px]
    fixedBackground: true,
    excluded: '',
  };

  let options = defaultOptions;

  let isExcluded = false;
  let isFrame = false;
  let direction = {
    x: 0,
    y: 0,
  };
  let initDone = false;
  let root = document.documentElement;
  let activeElement;
  let observer;
  let refreshSize;
  let deltaBuffer = [];
  let deltaBufferTimer;
  let isMac = /^Mac/.test(navigator.platform);

  let key = {
    left: 37,
    up: 38,
    right: 39,
    down: 40,
    spacebar: 32,
    pageup: 33,
    pagedown: 34,
    end: 35,
    home: 36,
  };
  let arrowKeys = {
    37: 1,
    38: 1,
    39: 1,
    40: 1,
  };

  // Tests if smooth scrolling is allowed. Shuts down everything if not.

  function initTest() {
    if (options.keyboardSupport) {
      addEvent('keydown', keydown);
    }
  }

  // Sets up scrolls array, determines if frames are involved.

  function init() {
    if (initDone || !document.body) return;

    initDone = true;

    let body = document.body;
    let html = document.documentElement;
    let windowHeight = window.innerHeight;
    let scrollHeight = body.scrollHeight;

    // check compat mode for root element
    root = document.compatMode.indexOf('CSS') >= 0 ? html : body;
    activeElement = body;

    initTest();

    // Checks if this script is running in a frame
    if (top != self) {
      isFrame = true;
    } else if (
      /**
       * Safari 10 fixed it, Chrome fixed it in v45:
       * This fixes a bug where the areas left and right to
       * the content does not trigger the onmousewheel event
       * on some pages. e.g.: html, body { height: 100% }
       */
      isOldSafari &&
      scrollHeight > windowHeight &&
      (body.offsetHeight <= windowHeight || html.offsetHeight <= windowHeight)
    ) {
      let fullPageElem = document.createElement('div');
      fullPageElem.style.cssText =
        'position:absolute; z-index:-10000; ' +
        'top:0; left:0; right:0; height:' +
        root.scrollHeight +
        'px';
      document.body.appendChild(fullPageElem);

      // DOM changed (throttled) to fix height
      let pendingRefresh;
      refreshSize = function () {
        if (pendingRefresh) return; // could also be: clearTimeout(pendingRefresh);
        pendingRefresh = setTimeout(function () {
          if (isExcluded) return; // could be running after cleanup
          fullPageElem.style.height = '0';
          fullPageElem.style.height = root.scrollHeight + 'px';
          pendingRefresh = null;
        }, 500); // act rarely to stay fast
      };

      setTimeout(refreshSize, 10);

      addEvent('resize', refreshSize);

      // TODO: attributeFilter?
      let config = {
        attributes: true,
        childList: true,
        characterData: false,
      };

      observer = new MutationObserver(refreshSize);
      observer.observe(body, config);

      if (root.offsetHeight <= windowHeight) {
        let clearfix = document.createElement('div');
        clearfix.style.clear = 'both';
        body.appendChild(clearfix);
      }
    }

    // disable fixed background
    if (!options.fixedBackground && !isExcluded) {
      body.style.backgroundAttachment = 'scroll';
      html.style.backgroundAttachment = 'scroll';
    }
  }

  // Removes event listeners and other traces left on the page.

  function cleanup() {
    observer && observer.disconnect();
    removeEvent(wheelEvent, wheel);
    removeEvent('mousedown', mousedown);
    removeEvent('keydown', keydown);
    removeEvent('resize', refreshSize);
    removeEvent('load', init);
  }

  /************************************************
                    SCROLLING
  *************************************************/

  let que = [];
  let pending = false;
  let lastScroll = Date.now();

  // Pushes scroll actions to the scrolling queue.

  function scrollArray(elem, left, top) {
    directionCheck(left, top);

    if (options.accelerationMax != 1) {
      let now = Date.now();
      let elapsed = now - lastScroll;
      if (elapsed < options.accelerationDelta) {
        let factor = (1 + 50 / elapsed) / 2;
        if (factor > 1) {
          factor = Math.min(factor, options.accelerationMax);
          left *= factor;
          top *= factor;
        }
      }
      lastScroll = Date.now();
    }

    // push a scroll command
    que.push({
      x: left,
      y: top,
      lastX: left < 0 ? 0.99 : -0.99,
      lastY: top < 0 ? 0.99 : -0.99,
      start: Date.now(),
    });

    // don't act if there's a pending queue
    if (pending) {
      return;
    }

    let scrollRoot = getScrollRoot();
    let isWindowScroll = elem === scrollRoot || elem === document.body;

    // if we haven't already fixed the behavior,
    // and it needs fixing for this sesh
    if (elem.$scrollBehavior == null && isScrollBehaviorSmooth(elem)) {
      elem.$scrollBehavior = elem.style.scrollBehavior;
      elem.style.scrollBehavior = 'auto';
    }

    let step = function (time) {
      let now = Date.now();
      let scrollX = 0;
      let scrollY = 0;

      for (let i = 0; i < que.length; i++) {
        let item = que[i];
        let elapsed = now - item.start;
        let finished = elapsed >= options.animationTime;

        // scroll position: [0, 1]
        let position = finished ? 1 : elapsed / options.animationTime;

        // easing [optional]
        if (options.pulseAlgorithm) {
          position = pulse(position);
        }

        // only need the difference
        let x = (item.x * position - item.lastX) >> 0;
        let y = (item.y * position - item.lastY) >> 0;

        // add this to the total scrolling
        scrollX += x;
        scrollY += y;

        // update last values
        item.lastX += x;
        item.lastY += y;

        // delete and step back if it's over
        if (finished) {
          que.splice(i, 1);
          i--;
        }
      }

      // scroll left and top
      if (isWindowScroll) {
        window.scrollBy(scrollX, scrollY);
      } else {
        if (scrollX) elem.scrollLeft += scrollX;
        if (scrollY) elem.scrollTop += scrollY;
      }

      // clean up if there's nothing left to do
      if (!left && !top) {
        que = [];
      }

      if (que.length) {
        requestFrame(step, elem, 1000 / options.frameRate + 1);
      } else {
        pending = false;

        // restore default behavior at the end of scrolling sesh
        if (elem.$scrollBehavior != null) {
          elem.style.scrollBehavior = elem.$scrollBehavior;
          elem.$scrollBehavior = null;
        }
      }
    };

    // start a new queue of actions
    requestFrame(step, elem, 0);
    pending = true;
  }

  /***********************************************
                     EVENTS
  ************************************************/

  /**
   * Mouse wheel handler.
   * @param {Object} event
   */
  function wheel(event) {
    if (!initDone) {
      init();
    }

    let target = event.target;

    // leave early if default action is prevented
    // or it's a zooming event with CTRL
    if (event.defaultPrevented || event.ctrlKey) {
      return true;
    }

    // leave embedded content alone (flash & pdf)
    if (
      isNodeName(activeElement, 'embed') ||
      (isNodeName(target, 'embed') && /\.pdf/i.test(target.src)) ||
      isNodeName(activeElement, 'object') ||
      target.shadowRoot
    ) {
      return true;
    }

    let deltaX = -event.wheelDeltaX || event.deltaX || 0;
    let deltaY = -event.wheelDeltaY || event.deltaY || 0;

    if (isMac) {
      if (event.wheelDeltaX && isDivisible(event.wheelDeltaX, 120)) {
        deltaX = -120 * (event.wheelDeltaX / Math.abs(event.wheelDeltaX));
      }
      if (event.wheelDeltaY && isDivisible(event.wheelDeltaY, 120)) {
        deltaY = -120 * (event.wheelDeltaY / Math.abs(event.wheelDeltaY));
      }
    }

    // use wheelDelta if deltaX/Y is not available
    if (!deltaX && !deltaY) {
      deltaY = -event.wheelDelta || 0;
    }

    // line based scrolling (Firefox mostly)
    if (event.deltaMode === 1) {
      deltaX *= 40;
      deltaY *= 40;
    }

    let overflowing = overflowingAncestor(target);

    // nothing to do if there's no element that's scrollable
    if (!overflowing) {
      // except Chrome iframes seem to eat wheel events, which we need to
      // propagate up, if the iframe has nothing overflowing to scroll
      if (isFrame && isChrome) {
        // change target to iframe element itself for the parent frame
        Object.defineProperty(event, 'target', {
          value: window.frameElement,
        });
        return parent.wheel(event);
      }
      return true;
    }

    // check if it's a touchpad scroll that should be ignored
    if (isTouchpad(deltaY)) {
      return true;
    }

    // scale by step size
    // delta is 120 most of the time
    // synaptics seems to send 1 sometimes
    if (Math.abs(deltaX) > 1.2) {
      deltaX *= options.stepSize / 120;
    }
    if (Math.abs(deltaY) > 1.2) {
      deltaY *= options.stepSize / 120;
    }

    scrollArray(overflowing, deltaX, deltaY);
    event.preventDefault();
    scheduleClearCache();
  }

  /**
   * Keydown event handler.
   * @param {Object} event
   */
  function keydown(event) {
    let target = event.target;
    let modifier =
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      (event.shiftKey && event.keyCode !== key.spacebar);

    // our own tracked active element could've been removed from the DOM
    if (!document.body.contains(activeElement)) {
      activeElement = document.activeElement;
    }

    // do nothing if user is editing text
    // or using a modifier key (except shift)
    // or in a dropdown
    // or inside interactive elements
    let inputNodeNames = /^(textarea|select|embed|object)$/i;
    let buttonTypes = /^(button|submit|radio|checkbox|file|color|image)$/i;
    if (
      event.defaultPrevented ||
      inputNodeNames.test(target.nodeName) ||
      (isNodeName(target, 'input') && !buttonTypes.test(target.type)) ||
      isNodeName(activeElement, 'video') ||
      isInsideYoutubeVideo(event) ||
      target.isContentEditable ||
      modifier
    ) {
      return true;
    }

    // [spacebar] should trigger button press, leave it alone
    if (
      (isNodeName(target, 'button') ||
        (isNodeName(target, 'input') && buttonTypes.test(target.type))) &&
      event.keyCode === key.spacebar
    ) {
      return true;
    }

    // [arrwow keys] on radio buttons should be left alone
    if (
      isNodeName(target, 'input') &&
      target.type == 'radio' &&
      arrowKeys[event.keyCode]
    ) {
      return true;
    }

    let shift,
      x = 0,
      y = 0;
    let overflowing = overflowingAncestor(activeElement);

    if (!overflowing) {
      // Chrome iframes seem to eat key events, which we need to
      // propagate up, if the iframe has nothing overflowing to scroll
      return isFrame && isChrome ? parent.keydown(event) : true;
    }

    let clientHeight = overflowing.clientHeight;

    if (overflowing == document.body) {
      clientHeight = window.innerHeight;
    }

    switch (event.keyCode) {
      case key.up:
        y = -options.arrowScroll;
        break;
      case key.down:
        y = options.arrowScroll;
        break;
      case key.spacebar: // (+ shift)
        shift = event.shiftKey ? 1 : -1;
        y = -shift * clientHeight * 0.9;
        break;
      case key.pageup:
        y = -clientHeight * 0.9;
        break;
      case key.pagedown:
        y = clientHeight * 0.9;
        break;
      case key.home:
        if (overflowing == document.body && document.scrollingElement)
          overflowing = document.scrollingElement;
        y = -overflowing.scrollTop;
        break;
      case key.end:
        let scroll = overflowing.scrollHeight - overflowing.scrollTop;
        let scrollRemaining = scroll - clientHeight;
        y = scrollRemaining > 0 ? scrollRemaining + 10 : 0;
        break;
      case key.left:
        x = -options.arrowScroll;
        break;
      case key.right:
        x = options.arrowScroll;
        break;
      default:
        return true; // a key we don't care about
    }

    scrollArray(overflowing, x, y);
    event.preventDefault();
    scheduleClearCache();
  }

  // Mousedown event only for updating activeElement

  function mousedown(event) {
    activeElement = event.target;
  }

  /***********************************************
                    OVERFLOW
  ************************************************/

  let uniqueID = (function () {
    let i = 0;
    return function (el) {
      return el.uniqueID || (el.uniqueID = i++);
    };
  })();

  let cacheX = {}; // cleared out after a scrolling session
  let cacheY = {}; // cleared out after a scrolling session
  let clearCacheTimer;
  let smoothBehaviorForElement = {};

  //setInterval(function () { cache = {}; }, 10 * 1000);

  function scheduleClearCache() {
    clearTimeout(clearCacheTimer);
    clearCacheTimer = setInterval(function () {
      cacheX = cacheY = smoothBehaviorForElement = {};
    }, 1 * 1000);
  }

  function setCache(elems, overflowing, x) {
    let cache = x ? cacheX : cacheY;
    for (let i = elems.length; i--; ) cache[uniqueID(elems[i])] = overflowing;
    return overflowing;
  }

  function getCache(el, x) {
    return (x ? cacheX : cacheY)[uniqueID(el)];
  }

  function overflowingAncestor(el) {
    let elems = [];
    let body = document.body;
    let rootScrollHeight = root.scrollHeight;
    do {
      let cached = getCache(el, false);
      if (cached) {
        return setCache(elems, cached);
      }
      elems.push(el);
      if (rootScrollHeight === el.scrollHeight) {
        let topOverflowsNotHidden =
          overflowNotHidden(root) && overflowNotHidden(body);
        let isOverflowCSS = topOverflowsNotHidden || overflowAutoOrScroll(root);
        if (
          (isFrame && isContentOverflowing(root)) ||
          (!isFrame && isOverflowCSS)
        ) {
          return setCache(elems, getScrollRoot());
        }
      } else if (isContentOverflowing(el) && overflowAutoOrScroll(el)) {
        return setCache(elems, el);
      }
    } while ((el = el.parentElement));
  }

  function isContentOverflowing(el) {
    return el.clientHeight + 10 < el.scrollHeight;
  }

  // typically for <body> and <html>
  function overflowNotHidden(el) {
    let overflow = getComputedStyle(el, '').getPropertyValue('overflow-y');
    return overflow !== 'hidden';
  }

  // for all other elements
  function overflowAutoOrScroll(el) {
    let overflow = getComputedStyle(el, '').getPropertyValue('overflow-y');
    return overflow === 'scroll' || overflow === 'auto';
  }

  // for all other elements
  function isScrollBehaviorSmooth(el) {
    let id = uniqueID(el);
    if (smoothBehaviorForElement[id] == null) {
      let scrollBehavior = getComputedStyle(el, '')['scroll-behavior'];
      smoothBehaviorForElement[id] = 'smooth' == scrollBehavior;
    }
    return smoothBehaviorForElement[id];
  }

  /***********************************************
                    HELPERS
  ************************************************/

  function addEvent(type, fn, arg) {
    window.addEventListener(type, fn, arg || false);
  }

  function removeEvent(type, fn, arg) {
    window.removeEventListener(type, fn, arg || false);
  }

  function isNodeName(el, tag) {
    return el && (el.nodeName || '').toLowerCase() === tag.toLowerCase();
  }

  function directionCheck(x, y) {
    x = x > 0 ? 1 : -1;
    y = y > 0 ? 1 : -1;
    if (direction.x !== x || direction.y !== y) {
      direction.x = x;
      direction.y = y;
      que = [];
      lastScroll = 0;
    }
  }

  if (window.localStorage && localStorage.SS_deltaBuffer) {
    try {
      // #46 Safari throws in private browsing for localStorage
      deltaBuffer = localStorage.SS_deltaBuffer.split(',');
    } catch (e) {}
  }

  function isTouchpad(deltaY) {
    if (!deltaY) return;
    if (!deltaBuffer.length) {
      deltaBuffer = [deltaY, deltaY, deltaY];
    }
    deltaY = Math.abs(deltaY);
    deltaBuffer.push(deltaY);
    deltaBuffer.shift();
    clearTimeout(deltaBufferTimer);
    deltaBufferTimer = setTimeout(function () {
      try {
        // #46 Safari throws in private browsing for localStorage
        localStorage.SS_deltaBuffer = deltaBuffer.join(',');
      } catch (e) {}
    }, 1000);
    let dpiScaledWheelDelta = deltaY > 120 && allDeltasDivisableBy(deltaY); // win64
    return (
      !allDeltasDivisableBy(120) &&
      !allDeltasDivisableBy(100) &&
      !dpiScaledWheelDelta
    );
  }

  function isDivisible(n, divisor) {
    return Math.floor(n / divisor) == n / divisor;
  }

  function allDeltasDivisableBy(divisor) {
    return (
      isDivisible(deltaBuffer[0], divisor) &&
      isDivisible(deltaBuffer[1], divisor) &&
      isDivisible(deltaBuffer[2], divisor)
    );
  }

  function isInsideYoutubeVideo(event) {
    let elem = event.target;
    let isControl = false;
    if (document.URL.indexOf('www.youtube.com/watch') != -1) {
      do {
        isControl =
          elem.classList && elem.classList.contains('html5-video-controls');
        if (isControl) break;
      } while ((elem = elem.parentNode));
    }
    return isControl;
  }

  let requestFrame = (function () {
    return (
      window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      function (callback, element, delay) {
        window.setTimeout(callback, delay || 1000 / 60);
      }
    );
  })();

  let MutationObserver =
    window.MutationObserver ||
    window.WebKitMutationObserver ||
    window.MozMutationObserver;

  let getScrollRoot = (function () {
    let SCROLL_ROOT = document.scrollingElement;
    return function () {
      if (!SCROLL_ROOT) {
        let dummy = document.createElement('div');
        dummy.style.cssText = 'height:10000px;width:1px;';
        document.body.appendChild(dummy);
        let bodyScrollTop = document.body.scrollTop;
        let docElScrollTop = document.documentElement.scrollTop;
        window.scrollBy(0, 3);
        if (document.body.scrollTop != bodyScrollTop)
          SCROLL_ROOT = document.body;
        else SCROLL_ROOT = document.documentElement;
        window.scrollBy(0, -3);
        document.body.removeChild(dummy);
      }
      return SCROLL_ROOT;
    };
  })();

  function pulse_(x) {
    let val, start, expx;
    // test
    x = x * options.pulseScale;
    if (x < 1) {
      // acceleartion
      val = x - (1 - Math.exp(-x));
    } else {
      // tail
      // the previous animation ended here:
      start = Math.exp(-1);
      // simple viscous drag
      x -= 1;
      expx = 1 - Math.exp(-x);
      val = start + expx * (1 - start);
    }
    return val * options.pulseNormalize;
  }

  function pulse(x) {
    if (x >= 1) return 1;
    if (x <= 0) return 0;

    if (options.pulseNormalize == 1) {
      options.pulseNormalize /= pulse_(1);
    }
    return pulse_(x);
  }

  /***********************************************
                    FIRST RUN
  ************************************************/

  let userAgent = window.navigator.userAgent;
  let isEdge = /Edge/.test(userAgent); // thank you MS
  let isChrome = /chrome/i.test(userAgent) && !isEdge;
  let isSafari = /safari/i.test(userAgent) && !isEdge;
  let isMobile = /mobile/i.test(userAgent);
  let isIEWin7 = /Windows NT 6.1/i.test(userAgent) && /rv:11/i.test(userAgent);
  let isOldSafari =
    isSafari &&
    (/Version\/8/i.test(userAgent) || /Version\/9/i.test(userAgent));
  let isEnabledForBrowser = (isChrome || isSafari || isIEWin7) && !isMobile;

  let supportsPassive = false;
  try {
    window.addEventListener(
      'test',
      null,
      Object.defineProperty({}, 'passive', {
        get: function () {
          supportsPassive = true;
        },
      })
    );
  } catch (e) {}

  let wheelOpt = supportsPassive
    ? {
        passive: false,
      }
    : false;
  let wheelEvent =
    'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';

  if (wheelEvent && isEnabledForBrowser) {
    addEvent(wheelEvent, wheel, wheelOpt);
    addEvent('mousedown', mousedown);
    addEvent('load', init);
  }

  /***********************************************
               PUBLIC INTERFACE
  ************************************************/

  function MouseSmooth(optionsToSet) {
    for (let key in optionsToSet)
      if (defaultOptions.hasOwnProperty(key)) options[key] = optionsToSet[key];
  }
  MouseSmooth.destroy = cleanup;

  if (window.MouseSmoothOptions) MouseSmooth(window.MouseSmoothOptions);

  if (typeof define === 'function' && define.amd) {
    define(function () {
      return MouseSmooth;
    });
  } else if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = MouseSmooth;
  } else {
    window.MouseSmooth = MouseSmooth;
  }
}

module.exports = {
  MouseSmooth,
};
