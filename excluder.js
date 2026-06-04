(function () {
    'use strict';

    const STORAGE_EXCLUDE = 'ABC_EXCLUDE_COLOR';
    const STORAGE_ARMED_EXCLUDE = 'ABC_ARMED_EXCLUDE_COLOR';
    const STORAGE_HISTORY = 'ABC_HIDDEN_CUSTOM_HISTORY';
    const STORAGE_SAVE_KEY = 'ABC_HIDDEN_SAVE_KEY';
    const STORAGE_PENDING_ROLL = 'ABC_PENDING_REAL_ROLL';

    const COLORS = ['red', 'orange', 'gold', 'green', 'blue', 'purple'];

    const COLOR_RGB = {
        red: 'rgb(255, 0, 0)',
        orange: 'rgb(255, 140, 0)',
        gold: 'rgb(255, 215, 0)',
        green: 'rgb(0, 128, 0)',
        blue: 'rgb(0, 0, 255)',
        purple: 'rgb(128, 0, 128)'
    };

    const KEY_GROUP = {
        '1': ['red', 'orange', 'gold'],
        '2': ['green', 'blue', 'purple']
    };

    const KEY_COOLDOWN_MS = 350;
    const PENDING_ROLL_LIMIT_MS = 20000;

    let lastKeyPressTime = { '1': 0, '2': 0 };
    let group1Index = -1;
    let group2Index = -1;
    let originalHistoryObserverStarted = false;
    let controlsHooked = false;
    let rollHooked = false;
    let isChangingDiceSetting = false;

    function isColorDiceMode() {
        const typeSelect = document.querySelector('#type-select');
        const title = document.querySelector('#sub-title2, h1, h2, h3');

        const typeText = typeSelect
            ? (typeSelect.options[typeSelect.selectedIndex]?.text || typeSelect.value || '').toLowerCase()
            : '';

        const pageText = title ? title.textContent.toLowerCase() : '';

        return (
            typeText.includes('color') ||
            pageText.includes('roll color dice') ||
            location.href.toLowerCase().includes('roll-color-dice')
        );
    }

    function getRealColor(color) {
        return COLOR_RGB[color] || color;
    }

    function markRealRollPending() {
        sessionStorage.setItem(STORAGE_PENDING_ROLL, String(Date.now()));
    }

    function hasRealRollPending() {
        const raw = sessionStorage.getItem(STORAGE_PENDING_ROLL);
        const time = raw ? parseInt(raw, 10) : 0;

        if (!time) return false;

        if (Date.now() - time > PENDING_ROLL_LIMIT_MS) {
            sessionStorage.removeItem(STORAGE_PENDING_ROLL);
            return false;
        }

        return true;
    }

    function clearRealRollPending() {
        sessionStorage.removeItem(STORAGE_PENDING_ROLL);
    }

    function waitReady(callback) {
        const timer = setInterval(function () {
            if (
                document.querySelector('#dice-roll-box') &&
                document.querySelector('#roll-button') &&
                document.querySelector('#tabletop') &&
                document.querySelector('#num-select') &&
                document.querySelector('#type-select')
            ) {
                clearInterval(timer);
                callback();
            }
        }, 100);
    }

    function getDiceCount() {
        const select = document.querySelector('#num-select');
        return select ? parseInt(select.value, 10) || 4 : 4;
    }

    function resetKeyCycle() {
        group1Index = -1;
        group2Index = -1;
    }

    function clearExclude() {
        localStorage.removeItem(STORAGE_EXCLUDE);
    }

    function clearArmedExclude() {
        localStorage.removeItem(STORAGE_ARMED_EXCLUDE);
    }

    function markDiceSettingChanging() {
        isChangingDiceSetting = true;
        clearRealRollPending();

        clearExclude();
        clearArmedExclude();
        resetKeyCycle();
        sessionStorage.removeItem(STORAGE_SAVE_KEY);

        setTimeout(function () {
            isChangingDiceSetting = false;

            if (!isColorDiceMode()) {
                cleanupNonColorDice();
            } else {
                hideOriginalHistoryOnly();
                renderHistory();
            }
        }, 800);
    }

    function restoreOriginalHistory() {
        ['#history', '#show-history', '#hide-history'].forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (el) {
                if (el.id && el.id.indexOf('abc-') === 0) return;

                el.style.removeProperty('display');
                el.style.removeProperty('visibility');
                el.style.removeProperty('opacity');
                el.style.removeProperty('height');
                el.style.removeProperty('max-height');
                el.style.removeProperty('overflow');
                el.style.removeProperty('pointer-events');
            });
        });
    }

    function cleanupNonColorDice() {
        clearRealRollPending();
        clearExclude();
        clearArmedExclude();
        resetKeyCycle();
        restoreOriginalHistory();

        const wrap = document.querySelector('#abc-custom-history-wrap');
        const show = document.querySelector('#abc-show-history');

        if (wrap) wrap.style.setProperty('display', 'none', 'important');
        if (show) show.style.setProperty('display', 'none', 'important');
    }

    function setExclude(color) {
        if (!isColorDiceMode()) return;
        localStorage.setItem(STORAGE_EXCLUDE, color);
    }

    function getExclude() {
        if (!isColorDiceMode()) return null;
        return localStorage.getItem(STORAGE_EXCLUDE);
    }

    function armExclude() {
        if (!isColorDiceMode()) {
            cleanupNonColorDice();
            return;
        }

        const color = getExclude();

        if (color && COLORS.includes(color)) {
            localStorage.setItem(STORAGE_ARMED_EXCLUDE, color);
        } else {
            clearArmedExclude();
        }
    }

    function getArmedExclude() {
        if (!isColorDiceMode()) return null;
        return localStorage.getItem(STORAGE_ARMED_EXCLUDE);
    }

    function normalizeColor(color) {
        if (!color) return null;

        color = String(color).trim().toLowerCase();

        if (color.indexOf('255, 0, 0') !== -1) return 'red';
        if (color.indexOf('255, 140, 0') !== -1) return 'orange';
        if (color.indexOf('255, 215, 0') !== -1) return 'gold';
        if (color.indexOf('0, 128, 0') !== -1) return 'green';
        if (color.indexOf('0, 0, 255') !== -1) return 'blue';
        if (color.indexOf('128, 0, 128') !== -1) return 'purple';

        if (color === 'yellow') return 'gold';
        if (color === 'gold') return 'gold';
        if (color === 'orange') return 'orange';
        if (COLORS.includes(color)) return color;

        return null;
    }

    function getDiceIcons() {
        const tabletop = document.querySelector('#tabletop');
        if (!tabletop) return [];

        let icons = Array.from(tabletop.querySelectorAll('i[class*="df-solid"]'));
        const count = getDiceCount();

        if (icons.length > count) icons = icons.slice(-count);
        return icons;
    }

    function getCurrentColors() {
        if (!isColorDiceMode()) return [];
        if (isChangingDiceSetting) return [];

        return getDiceIcons().map(function (icon) {
            return normalizeColor(icon.style.color) ||
                normalizeColor(getComputedStyle(icon).color) ||
                null;
        }).filter(Boolean);
    }

    function getReplacementColor(excludedColor, currentColors) {
        let choices = COLORS.filter(function (c) {
            return c !== excludedColor && currentColors.indexOf(c) === -1;
        });

        if (!choices.length) {
            choices = COLORS.filter(function (c) {
                return c !== excludedColor;
            });
        }

        return choices[Math.floor(Math.random() * choices.length)];
    }

    function applyExclude(colors, excludedColor) {
        if (!isColorDiceMode()) return [];
        if (!excludedColor || !COLORS.includes(excludedColor)) return colors;

        const finalColors = colors.slice();

        for (let i = 0; i < finalColors.length; i++) {
            if (finalColors[i] === excludedColor) {
                finalColors[i] = getReplacementColor(excludedColor, finalColors);
            }
        }

        return finalColors;
    }

    function applyColorsToOriginal(colors) {
        if (!isColorDiceMode()) return;
        if (isChangingDiceSetting) return;

        const icons = getDiceIcons();

        icons.forEach(function (icon, index) {
            if (colors[index]) {
                icon.style.setProperty('color', getRealColor(colors[index]), 'important');
            }
        });
    }

    function loadHistory() {
        try {
            const h = JSON.parse(localStorage.getItem(STORAGE_HISTORY));
            return Array.isArray(h) ? h : [];
        } catch (e) {
            return [];
        }
    }

    function saveHistory(history) {
        localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 20)));
    }

    function getColorPatternKey(colors) {
        if (!Array.isArray(colors)) return '';
        return colors.slice().sort().join('|');
    }

    function isSameColorPattern(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        return getColorPatternKey(a) === getColorPatternKey(b);
    }

    function addHistory(colors) {
        if (!isColorDiceMode()) return;
        if (isChangingDiceSetting) return;
        if (!colors || !colors.length) return;

        if (getDiceCount() > 6) {
            renderHistory();
            return;
        }

        const history = loadHistory();

        if (history.length && isSameColorPattern(colors, history[0])) {
            renderHistory();
            return;
        }

        const saveKey = location.href + '|' + getColorPatternKey(colors);

        if (sessionStorage.getItem(STORAGE_SAVE_KEY) === saveKey) {
            renderHistory();
            return;
        }

        sessionStorage.setItem(STORAGE_SAVE_KEY, saveKey);

        history.unshift(colors);
        saveHistory(history);
        renderHistory();
    }

    function createSmallDice(color) {
        const dice = document.createElement('div');
        dice.className = 'dice-wrapper';
        dice.style.cssText =
            'vertical-align:middle;' +
            'margin:5px 2px;' +
            'display:inline-block;' +
            'background:#fff!important;' +
            'font-size:32px!important;' +
            'width:32px!important;' +
            'height:32px!important;' +
            'border-radius:5px!important;';

        const icon = document.createElement('i');
        icon.className = 'df-solid-small-dot-d6-1';
        icon.style.setProperty('color', getRealColor(color), 'important');

        dice.appendChild(icon);
        return dice;
    }

    function createHistoryRow(colors, index) {
        const row = document.createElement('div');
        row.className = 'abc-history-row';

        const number = document.createElement('div');
        number.textContent = (index + 1) + '.';
        number.className = 'abc-history-number';

        row.appendChild(number);

        colors.forEach(function (color) {
            row.appendChild(createSmallDice(color));
        });

        return row;
    }

    function createCustomHistory() {
        const oldWrap = document.querySelector('#abc-custom-history-wrap');
        if (oldWrap) oldWrap.remove();

        const oldShow = document.querySelector('#abc-show-history');
        if (oldShow) oldShow.remove();

        const showLink = document.createElement('div');
        showLink.id = 'abc-show-history';
        showLink.textContent = 'Your Last 20 Rolls  ↓';
        showLink.style.cssText =
            'display:none;' +
            'text-decoration:underline;' +
            'cursor:pointer;' +
            'margin-top:5px;' +
            'font-family:Arial,sans-serif;' +
            'font-size:14px;' +
            'text-align:center;';

        const wrap = document.createElement('div');
        wrap.id = 'abc-custom-history-wrap';

        const history = document.createElement('div');
        history.id = 'abc-custom-history';
        history.className = 'card two-thirds block padded more-rounded filled';

        history.innerHTML =
            '<div id="abc-hide-history" style="position:absolute;top:10px;right:15px;font-size:14px;cursor:pointer;z-index:9999;">x</div>' +
            '<h4 class="section-title">Your Last 20 Rolls</h4>' +
            '<div class="card full block rounded" style="text-align:left;">' +
            '<div id="abc-history-content" class="section-text"></div>' +
            '</div>';

        wrap.appendChild(history);

        const box = document.querySelector('#dice-roll-box');

        if (box && box.parentNode) {
            const chanceText = Array.from(box.querySelectorAll('*')).find(function (el) {
                return el.textContent &&
                    el.textContent.toLowerCase().indexOf('see your winning chance') !== -1;
            });

            if (chanceText) {
                chanceText.insertAdjacentElement('afterend', showLink);
            } else {
                box.appendChild(showLink);
            }

            box.parentNode.insertBefore(wrap, box.nextSibling);
        }

        showLink.addEventListener('click', function () {
            if (!isColorDiceMode()) {
                cleanupNonColorDice();
                return;
            }

            const historyWrap = document.querySelector('#abc-custom-history-wrap');

            if (historyWrap) {
                historyWrap.style.setProperty('display', 'flex', 'important');
            }

            showLink.style.setProperty('display', 'none', 'important');
        });

        setTimeout(function () {
            const btn = document.querySelector('#abc-hide-history');

            if (!btn) return;

            btn.addEventListener('click', function () {
                const historyWrap = document.querySelector('#abc-custom-history-wrap');
                const show = document.querySelector('#abc-show-history');

                if (historyWrap) {
                    historyWrap.style.setProperty('display', 'none', 'important');
                }

                if (show && isColorDiceMode()) {
                    show.style.setProperty('display', 'block', 'important');
                }
            });
        }, 100);
    }

    function renderHistory() {
        const wrap = document.querySelector('#abc-custom-history-wrap');
        const showLink = document.querySelector('#abc-show-history');
        const history = document.querySelector('#abc-custom-history');

        if (!history) return;

        if (!isColorDiceMode()) {
            cleanupNonColorDice();
            return;
        }

        if (getDiceCount() > 6) {
            if (wrap) wrap.style.setProperty('display', 'none', 'important');
            if (showLink) showLink.style.setProperty('display', 'none', 'important');
            return;
        }

        if (wrap) wrap.style.setProperty('display', 'flex', 'important');
        if (showLink) showLink.style.setProperty('display', 'none', 'important');

        history.style.display = 'block';

        const content = document.querySelector('#abc-history-content');
        if (!content) return;

        content.innerHTML = '';

        loadHistory().forEach(function (colors, index) {
            content.appendChild(createHistoryRow(colors, index));
        });
    }

    function hideOriginalHistoryOnly() {
        if (!isColorDiceMode()) {
            restoreOriginalHistory();
            return;
        }

        ['#history', '#show-history', '#hide-history'].forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (el) {
                if (el.id && el.id.indexOf('abc-') === 0) return;

                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('height', '0', 'important');
                el.style.setProperty('max-height', '0', 'important');
                el.style.setProperty('overflow', 'hidden', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
            });
        });
    }

    function keepOriginalHistoryHidden() {
        if (originalHistoryObserverStarted) return;
        originalHistoryObserverStarted = true;

        hideOriginalHistoryOnly();

        const observer = new MutationObserver(function () {
            hideOriginalHistoryOnly();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    function hookRollButton() {
        const roll = document.querySelector('#roll-button');
        if (!roll || rollHooked) return;

        rollHooked = true;

        roll.addEventListener('click', function () {
            if (!isColorDiceMode()) {
                cleanupNonColorDice();
                return;
            }

            markRealRollPending();
            isChangingDiceSetting = false;
            armExclude();
            sessionStorage.removeItem(STORAGE_SAVE_KEY);

            setTimeout(hideOriginalHistoryOnly, 100);
            setTimeout(hideOriginalHistoryOnly, 500);
            setTimeout(hideOriginalHistoryOnly, 1200);

            setTimeout(processAfterOriginalRoll, 500);
            setTimeout(processAfterOriginalRoll, 1000);
            setTimeout(processAfterOriginalRoll, 1500);
            setTimeout(processAfterOriginalRoll, 2200);
        }, true);
    }

    function processAfterOriginalRoll() {
        hideOriginalHistoryOnly();

        if (!isColorDiceMode()) {
            cleanupNonColorDice();
            return;
        }

        if (isChangingDiceSetting) return;

        if (!hasRealRollPending()) {
            renderHistory();
            return;
        }

        const armedExclude = getArmedExclude();

        let finalColors = getCurrentColors();

        if (!finalColors.length) return;

        if (armedExclude && COLORS.includes(armedExclude)) {
            finalColors = applyExclude(finalColors, armedExclude);
            applyColorsToOriginal(finalColors);
            clearArmedExclude();
            clearExclude();
            resetKeyCycle();
        }

        addHistory(finalColors);
        clearRealRollPending();

        setTimeout(hideOriginalHistoryOnly, 200);
        setTimeout(hideOriginalHistoryOnly, 800);
        setTimeout(hideOriginalHistoryOnly, 1500);
    }

    function canAcceptKey(key) {
        const now = Date.now();

        if (now - lastKeyPressTime[key] < KEY_COOLDOWN_MS) {
            return false;
        }

        lastKeyPressTime[key] = now;
        return true;
    }

    function hookKeyboard() {
        document.addEventListener('keydown', function (e) {
            if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(e.target.tagName) !== -1) return;

            if (e.repeat) {
                e.preventDefault();
                return;
            }

            const key = e.key.toLowerCase();

            if (!isColorDiceMode()) {
                if (key === '1' || key === '2' || key === '0' || key === 'x' || key === 'backspace') {
                    cleanupNonColorDice();
                }
                return;
            }

            if (key === '0' || key === 'x' || key === 'backspace') {
                e.preventDefault();
                clearExclude();
                clearArmedExclude();
                resetKeyCycle();
                return;
            }

            if (key === '1') {
                e.preventDefault();

                if (!canAcceptKey('1')) return;

                group1Index++;
                if (group1Index > 2) group1Index = 0;

                setExclude(KEY_GROUP['1'][group1Index]);
                return;
            }

            if (key === '2') {
                e.preventDefault();

                if (!canAcceptKey('2')) return;

                group2Index++;
                if (group2Index > 2) group2Index = 0;

                setExclude(KEY_GROUP['2'][group2Index]);
                return;
            }
        }, true);
    }

    function hookDiceControls() {
        if (controlsHooked) return;
        controlsHooked = true;

        ['#theme-select', '#type-select', '#num-select'].forEach(function (selector) {
            const el = document.querySelector(selector);
            if (!el) return;

            el.addEventListener('change', function () {
                markDiceSettingChanging();
            }, true);
        });
    }

    function hideAdLayoutPushers() {
        [
            '#ad-box-left',
            '#ad-box-right',
            '#ad-box-top',
            '#fixed-ad-top'
        ].forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (el) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('width', '0', 'important');
                el.style.setProperty('height', '0', 'important');
                el.style.setProperty('min-height', '0', 'important');
                el.style.setProperty('margin', '0', 'important');
                el.style.setProperty('padding', '0', 'important');
            });
        });
    }

    function injectCss() {
        const old = document.querySelector('#abc-hidden-css');
        if (old) old.remove();

        const style = document.createElement('style');
        style.id = 'abc-hidden-css';

        style.textContent =
            '#ad-box-left,#ad-box-right,#ad-box-top,#fixed-ad-top{' +
                'display:none!important;' +
                'visibility:hidden!important;' +
                'width:0!important;' +
                'height:0!important;' +
                'min-height:0!important;' +
                'margin:0!important;' +
                'padding:0!important;' +
                'overflow:hidden!important;' +
            '}' +

            '#history:not([id^="abc-"]),#show-history:not([id^="abc-"]),#hide-history:not([id^="abc-"]){' +
                'display:none!important;' +
                'visibility:hidden!important;' +
                'opacity:0!important;' +
                'height:0!important;' +
                'max-height:0!important;' +
                'overflow:hidden!important;' +
                'pointer-events:none!important;' +
            '}' +

            '#dice-roll-box{' +
                'display:block!important;' +
                'float:none!important;' +
                'clear:both!important;' +
                'margin-left:auto!important;' +
                'margin-right:auto!important;' +
                'margin-top:270px!important;' +
                'box-sizing:border-box!important;' +
                'vertical-align:top!important;' +
            '}' +

            '#roll-button{' +
                'box-sizing:border-box!important;' +
            '}' +

            '#abc-show-history{' +
                'display:none;' +
                'text-decoration:underline!important;' +
                'cursor:pointer!important;' +
                'margin-top:5px!important;' +
                'font-family:Arial,sans-serif!important;' +
                'font-size:14px!important;' +
                'text-align:center!important;' +
                'visibility:visible!important;' +
                'opacity:1!important;' +
                'height:auto!important;' +
                'max-height:none!important;' +
                'overflow:visible!important;' +
                'pointer-events:auto!important;' +
            '}' +

            '#abc-custom-history-wrap{' +
                'display:flex!important;' +
                'justify-content:center!important;' +
                'align-items:center!important;' +
                'width:100%!important;' +
                'margin-top:35px!important;' +
                'clear:both!important;' +
                'box-sizing:border-box!important;' +
            '}' +

            '#abc-custom-history{' +
                'width:650px!important;' +
                'max-width:calc(100vw - 30px)!important;' +
                'margin:0!important;' +
                'float:none!important;' +
                'clear:both!important;' +
                'position:relative!important;' +
                'left:auto!important;' +
                'right:auto!important;' +
                'text-align:center!important;' +
                'padding-top:35px!important;' +
                'box-sizing:border-box!important;' +
            '}' +

            '#abc-hide-history{' +
                'position:absolute!important;' +
                'top:10px!important;' +
                'right:15px!important;' +
                'font-size:14px!important;' +
                'cursor:pointer!important;' +
                'z-index:9999!important;' +
                'display:block!important;' +
                'visibility:visible!important;' +
                'opacity:1!important;' +
                'height:auto!important;' +
                'max-height:none!important;' +
                'pointer-events:auto!important;' +
            '}' +

            '#abc-custom-history .card.full{' +
                'box-sizing:border-box!important;' +
                'width:100%!important;' +
            '}' +

            '#abc-custom-history .section-text{' +
                'text-transform:none!important;' +
                'text-align:left!important;' +
                'box-sizing:border-box!important;' +
            '}' +

            '#abc-history-content{' +
                'width:100%!important;' +
                'box-sizing:border-box!important;' +
                'overflow:hidden!important;' +
            '}' +

            '.abc-history-row{' +
                'width:100%!important;' +
                'box-sizing:border-box!important;' +
                'border-bottom:1px dashed #fff!important;' +
                'padding-bottom:5px!important;' +
                'margin-bottom:5px!important;' +
                'text-align:left!important;' +
                'white-space:nowrap!important;' +
                'overflow:hidden!important;' +
            '}' +

            '.abc-history-number{' +
                'margin-right:5px!important;' +
                'text-align:right!important;' +
                'width:25px!important;' +
                'display:inline-block!important;' +
                'vertical-align:middle!important;' +
                'color:#fff!important;' +
                'font-weight:bold!important;' +
            '}' +

            '@media only screen and (max-width:700px){' +
                '#dice-roll-box,' +
                '#abc-custom-history{' +
                    'width:calc(100vw - 24px)!important;' +
                    'max-width:calc(100vw - 24px)!important;' +
                '}' +
            '}';

        document.head.appendChild(style);
    }

    function init() {
        hideAdLayoutPushers();
        hideOriginalHistoryOnly();
        keepOriginalHistoryHidden();
        createCustomHistory();
        hookRollButton();
        hookDiceControls();
        injectCss();
        renderHistory();

        setTimeout(hideAdLayoutPushers, 300);
        setTimeout(hideAdLayoutPushers, 1000);

        setTimeout(hideOriginalHistoryOnly, 300);
        setTimeout(hideOriginalHistoryOnly, 1000);
        setTimeout(hideOriginalHistoryOnly, 2000);

        setTimeout(processAfterOriginalRoll, 500);
        setTimeout(processAfterOriginalRoll, 1000);
        setTimeout(processAfterOriginalRoll, 1500);
        setTimeout(processAfterOriginalRoll, 2200);

        setInterval(function () {
            if (!isColorDiceMode()) {
                cleanupNonColorDice();
            } else {
                hideOriginalHistoryOnly();
            }
        }, 700);
    }

    waitReady(init);
    hookKeyboard();

})();
