(function () {
    'use strict';

    const STORAGE_ARMED = 'ABC_HIDDEN_ARMED_QUEUE';
    const STORAGE_HISTORY = 'ABC_HIDDEN_CUSTOM_HISTORY';
    const STORAGE_SAVE_KEY = 'ABC_HIDDEN_SAVE_KEY';

    const COLORS = ['red', 'orange', 'gold', 'green', 'blue', 'purple'];

    const KEY_INTERVAL_MS = 1000; // 2 seconds cooldown para iwas double click

    let selectedColorIndex = -1;
    let selectedAmount = 0;

    let lastColorKeyTime = 0;
    let lastAmountKeyTime = 0;

    function canPressColorKey() {
        const now = Date.now();
        if (now - lastColorKeyTime < KEY_INTERVAL_MS) return false;
        lastColorKeyTime = now;
        return true;
    }

    function canPressAmountKey() {
        const now = Date.now();
        if (now - lastAmountKeyTime < KEY_INTERVAL_MS) return false;
        lastAmountKeyTime = now;
        return true;
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

    function isThirtyDiceMode() {
        return getDiceCount() === 30;
    }

    function buildQueueFromSelection() {
        if (!isThirtyDiceMode()) return [];
        if (selectedColorIndex < 0 || selectedAmount <= 0) return [];

        const color = COLORS[selectedColorIndex];
        const amount = Math.min(selectedAmount, 30);
        const queue = [];

        for (let i = 0; i < amount; i++) {
            queue.push(color);
        }

        return queue;
    }

    function armQueue() {
        localStorage.setItem(STORAGE_ARMED, JSON.stringify(buildQueueFromSelection()));
    }

    function loadArmedQueue() {
        try {
            const q = JSON.parse(localStorage.getItem(STORAGE_ARMED));
            return Array.isArray(q) ? q.filter(c => COLORS.includes(c)) : [];
        } catch (e) {
            return [];
        }
    }

    function clearArmedQueue() {
        localStorage.removeItem(STORAGE_ARMED);
    }

    function clearSelection() {
        selectedColorIndex = -1;
        selectedAmount = 0;
        lastColorKeyTime = 0;
        lastAmountKeyTime = 0;
    }

    function normalizeColor(color) {
        if (!color) return null;

        color = String(color).trim().toLowerCase();

        if (color.indexOf('255, 0, 0') !== -1) return 'red';
        if (color.indexOf('255, 140, 0') !== -1) return 'orange';
        if (color.indexOf('255, 165, 0') !== -1) return 'orange';
        if (color.indexOf('255, 215, 0') !== -1) return 'gold';
        if (color.indexOf('0, 128, 0') !== -1) return 'green';
        if (color.indexOf('0, 0, 255') !== -1) return 'blue';
        if (color.indexOf('128, 0, 128') !== -1) return 'purple';

        if (color === 'yellow') return 'gold';
        if (color === 'gold') return 'gold';
        if (COLORS.includes(color)) return color;

        return null;
    }

    function randomColor(exclude) {
        exclude = exclude || [];
        const allowed = COLORS.filter(c => !exclude.includes(c));
        const pool = allowed.length ? allowed : COLORS;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function shuffleArray(arr) {
        const a = arr.slice();

        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = a[i];
            a[i] = a[j];
            a[j] = temp;
        }

        return a;
    }

    function getCurrentColors() {
        const tabletop = document.querySelector('#tabletop');
        if (!tabletop) return [];

        let icons = Array.from(tabletop.querySelectorAll('i[class*="df-solid"]'));
        const count = getDiceCount();

        if (icons.length > count) icons = icons.slice(-count);

        return icons.map(function (icon) {
            return normalizeColor(icon.style.color) ||
                normalizeColor(getComputedStyle(icon).color) ||
                randomColor();
        }).slice(0, count);
    }

    function buildQueuedResult(queue) {
        const count = getDiceCount();

        let result = getCurrentColors();

        while (result.length < count) {
            result.push(randomColor());
        }

        result = result.slice(0, count);

        if (!queue.length || !isThirtyDiceMode()) return result;

        const forced = queue.slice(0, count);
        const forcedColors = Array.from(new Set(forced));

        for (let i = 0; i < result.length; i++) {
            if (forcedColors.includes(result[i])) {
                result[i] = randomColor(forcedColors);
            }
        }

        const randomIndexes = shuffleArray([...Array(count).keys()]).slice(0, forced.length);

        forced.forEach(function (color, i) {
            result[randomIndexes[i]] = color;
        });

        return result;
    }

    function applyColorsToOriginal(colors) {
        const tabletop = document.querySelector('#tabletop');
        if (!tabletop) return;

        let icons = Array.from(tabletop.querySelectorAll('i[class*="df-solid"]'));
        const count = getDiceCount();

        if (icons.length > count) icons = icons.slice(-count);

        icons.forEach(function (icon, index) {
            if (colors[index]) {
                icon.style.setProperty('color', colors[index], 'important');
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

    function addHistory(colors) {
        if (!colors || !colors.length) return;

        if (getDiceCount() > 6) {
            renderHistory();
            return;
        }

        const saveKey = location.href + '|' + colors.join('|');

        if (sessionStorage.getItem(STORAGE_SAVE_KEY) === saveKey) return;

        sessionStorage.setItem(STORAGE_SAVE_KEY, saveKey);

        const history = loadHistory();
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
        icon.style.setProperty('color', color, 'important');

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

                if (show) {
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
        const history = document.querySelector('#history');
        const showHistory = document.querySelector('#show-history');

        if (history) {
            history.style.setProperty('display', 'none', 'important');
            history.style.setProperty('visibility', 'hidden', 'important');
        }

        if (showHistory) {
            showHistory.style.setProperty('display', 'none', 'important');
            showHistory.style.setProperty('visibility', 'hidden', 'important');
        }
    }

    function hookRollButton() {
        const roll = document.querySelector('#roll-button');
        if (!roll) return;

        roll.addEventListener('click', function () {
            armQueue();
            sessionStorage.removeItem(STORAGE_SAVE_KEY);
        }, true);
    }

    function processAfterOriginalRoll() {
        const armedQueue = loadArmedQueue();
        let finalColors;

        if (armedQueue.length && isThirtyDiceMode()) {
            finalColors = buildQueuedResult(armedQueue);
            applyColorsToOriginal(finalColors);
            clearArmedQueue();
            clearSelection();
        } else {
            finalColors = getCurrentColors();
            clearArmedQueue();
            if (!isThirtyDiceMode()) clearSelection();
        }

        addHistory(finalColors);
    }

    function hookKeyboard() {
        document.addEventListener('keydown', function (e) {
            if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(e.target.tagName) !== -1) return;

            const key = e.key.toLowerCase();

            if (!isThirtyDiceMode()) {
                return;
            }

            if (key === '1') {
                e.preventDefault();

                if (!canPressColorKey()) {
                    console.log('COLOR KEY COOLDOWN: wait 2 seconds');
                    return;
                }

                selectedColorIndex++;
                if (selectedColorIndex >= COLORS.length) selectedColorIndex = 0;

                console.log('SELECTED COLOR:', COLORS[selectedColorIndex]);
                return;
            }

            if (key === '2') {
                e.preventDefault();

                if (!canPressAmountKey()) {
                    console.log('AMOUNT KEY COOLDOWN: wait 2 seconds');
                    return;
                }

                selectedAmount++;
                if (selectedAmount > 30) selectedAmount = 1;

                console.log('SELECTED AMOUNT:', selectedAmount);
                return;
            }

            if (key === 'backspace') {
                e.preventDefault();
                selectedAmount = Math.max(0, selectedAmount - 1);
                console.log('SELECTED AMOUNT:', selectedAmount);
                return;
            }

            if (key === '0' || key === 'x') {
                e.preventDefault();
                clearSelection();
                console.log('SELECTION CLEARED');
            }
        }, true);
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
            '#history,#show-history{display:none!important;visibility:hidden!important;}' +

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

            '#tabletop{' +
                'text-align:center!important;' +
                'display:flex!important;' +
                'justify-content:center!important;' +
                'align-items:center!important;' +
                'flex-wrap:wrap!important;' +
                'gap:8px!important;' +
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
        createCustomHistory();
        hookRollButton();
        injectCss();

        setTimeout(hideAdLayoutPushers, 300);
        setTimeout(hideAdLayoutPushers, 1000);

        setTimeout(processAfterOriginalRoll, 500);
        setTimeout(processAfterOriginalRoll, 1000);
        setTimeout(processAfterOriginalRoll, 1500);
    }

    waitReady(init);
    hookKeyboard();

})();
