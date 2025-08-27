// === Robust price source helpers (anti "dead minutes") ===
let __priceNode = null;
let __lastPriceTs = 0;
let __priceObserver = null;

function __parseFirstFloat(text) {
  if (!text) return null;
  const m = String(text).replace(/[, ]+/g,'').match(/-?\d+\.\d{3,6}/);
  return m ? parseFloat(m[0]) : null;
}

function __scanPriceNode() {
  const selectors = [
    '.current-price, .js-asset-price, .asset-price',
    '.trading-view [data-role="price"], .chart-price, .price-value',
    '.tooltip-text'
  ];
  for (const sel of selectors) {
    const node = document.querySelector(sel);
    if (node) {
      const v = __parseFirstFloat(node.textContent || node.innerText || '');
      if (typeof v === 'number' && isFinite(v)) return node;
    }
  }
  const all = Array.from(document.querySelectorAll('span,div,strong,b'));
  for (const n of all) {
    const val = __parseFirstFloat(n.textContent || n.innerText || '');
    if (typeof val === 'number' && isFinite(val)) return n;
  }
  return null;
}

function __attachPriceObserver(node) {
  if (__priceObserver) { try { __priceObserver.disconnect(); } catch(e){} }
  if (!node) return;
  __priceObserver = new MutationObserver(() => {
    const v = __parseFirstFloat(node.textContent || node.innerText || '');
    if (typeof v === 'number' && isFinite(v)) {
      globalPrice = v;
      __lastPriceTs = Date.now();
    }
  });
  __priceObserver.observe(node, { characterData: true, subtree: true, childList: true });
}

function getCurrentPriceLegacy() {
  try {
    if (!__priceNode || !document.body.contains(__priceNode)) {
      __priceNode = __scanPriceNode();
      __attachPriceObserver(__priceNode);
    }
    const instant = __priceNode ? __parseFirstFloat(__priceNode.textContent || __priceNode.innerText || '') : null;
    if (typeof instant === 'number' && isFinite(instant)) {
      globalPrice = instant;
      __lastPriceTs = Date.now();
      return globalPrice;
    }
    return typeof globalPrice === 'number' ? globalPrice : 0;
  } catch (e) {
    return typeof globalPrice === 'number' ? globalPrice : 0;
  }
}
// === End robust price helpers ===


// == Управление ставкой через имитацию клавиш (на основе старой версии) ==
function __pressHotkey(hk) { try { document.dispatchEvent(new KeyboardEvent('keyup', hk)); } catch(e) {} }
function decreaseBet() { __pressHotkey(Hotkeys.DECREASE); }
function increaseBet() { __pressHotkey(Hotkeys.INCREASE); }

// Сбросить сумму ставки (много раз нажать уменьшение)
function resetStakeToMin(clicks=40, delayMs=6) {
    for (let i = 0; i < clicks; i++) setTimeout(() => decreaseBet(), i * delayMs);
}

// Выставить сумму по текущему шагу mgState через pressCount
function setStakeByKeysForCurrentStep(doneCb) {
    try {
        const arr = __betLevels[mgState.level] || __betLevels[0];
        const cur = arr[Math.min(mgState.step, arr.length - 1)];
        const presses = Number(cur && cur.pressCount || 0);
        // Сначала сильный сброс до минимума
        const resetClicks = 40;
        const delay = 6;
        for (let i = 0; i < resetClicks; i++) setTimeout(() => decreaseBet(), i * delay);
        // Затем нажимаем "+" нужное количество раз
        const startAfter = resetClicks * delay + 120;
        for (let j = 0; j < presses; j++) setTimeout(() => increaseBet(), startAfter + j * delay);
        const totalDelay = startAfter + presses * delay + 50;
        if (typeof doneCb === 'function') setTimeout(doneCb, totalDelay);
    } catch(e) {
        console.error('setStakeByKeysForCurrentStep error:', e);
        if (typeof doneCb === 'function') doneCb();
    }
}
// == Базовые настройки ==
const appversion = "Level05-CandleSuite-v2.1-Simplified-MG";
const mode = 'DEMO'; // 'DEMO' или 'REAL'
const candleInterval = 60000; // 1 минута в миллисекундах
const emaPeriod = 5; // Период для EMA
const rsiPeriod = 3; // Период для RSI
const expiryTime = 1;
// === Noise filter settings ===
const atrPeriod = 14;                 // ATR period (bars)
const minATRTicks = 5;                // Minimum ATR in ticks to allow trading
const stdPeriod = 20;                 // StdDev period over close-to-close returns
const minSTDTicks = 2;                // Minimum StdDev (in ticks)
const minDistanceEMATicks = 2;        // Require |price-EMA| >= this many ticks
const narrowRangeBars = 5;            // Lookback bars for "narrow range" check (completed bars)
const narrowRangeMaxTicks = 3;        // If range <= this (in ticks), block entries

// === Level05 chart & storage ===
const MAX_M1_CANDLES = 1440; // last 1 day of M1 candles
let chartTimeframe = '1m';
let chartBars = 60;
let chartOffset = 0;
const CHART_ZOOM_MIN = 20, CHART_ZOOM_MAX = 240;
// minute-sync state (kept from v1.5)
 // Время экспирации в минутах

// == Глобальные переменные ==
let botStartBalance = null; // captured on first balance update
// == Martingale bet arrays & cycle limits ==
const betArray1 = [
    {step: 0, value: 1,  pressCount: 0},
    {step: 1, value: 3,  pressCount: 2},
    {step: 2, value: 8,  pressCount: 7},
    {step: 3, value: 20, pressCount: 11}
];
const betArray2 = [
    {step: 0, value: 3,  pressCount: 2},
    {step: 1, value: 8,  pressCount: 7},
    {step: 2, value: 20, pressCount: 11},
    {step: 3, value: 45, pressCount: 16}
];
const betArray3 = [
    {step: 0, value: 8,  pressCount: 7},
    {step: 1, value: 20, pressCount: 11},
    {step: 2, value: 45, pressCount: 16},
    {step: 3, value: 90, pressCount: 21}
];

const limitWin1  = 50;
const limitLoss1 = -30;
const limitWin2  = 100;
const limitLoss2 = -70;
const limitWin3  = 120;
const limitLoss3 = -170;

const __betLevels = [betArray1, betArray2, betArray3];
const __winLimits = [limitWin1, limitWin2, limitWin3];
const __lossLimits = [limitLoss1, limitLoss2, limitLoss3];

// Martingale state
let mgState = {
    level: 0,           // 0..2 -> betArray1..3
    step: 0,            // index into current bet array
    cycleStartBalance: null, // balance when current cycle started
    currentMaxStep: 0   // max step reached in current cycle
};

// Ensure cycle start balance is set
function __ensureCycleStartBalance() {
    if (mgState.cycleStartBalance == null && typeof currentBalance === 'number') {
        mgState.cycleStartBalance = currentBalance;
        console.log(`[MG] Cycle start balance set: ${mgState.cycleStartBalance.toFixed(2)}`);
    }
}

// Decide next level after cycle end
function __computeNextLevelAfterCycle(hitType /* 'win' | 'loss' */) {
    if (hitType === 'win') return 0; // Reset to betArray1 after win limit
    if (hitType === 'loss') return (mgState.level < 2) ? mgState.level + 1 : 0; // Escalate or wrap to betArray1
    return mgState.level; // No change for other cases
}

// Get the next stake based on current mgState
function getNextStake() {
    const arr = __betLevels[mgState.level] || __betLevels[0];
    const cur = arr[Math.min(mgState.step, arr.length - 1)];
    return cur && typeof cur.value === 'number' ? cur.value : __betLevels[0][0].value;
}

// Update Martingale state after trade result
function __updateMartingaleAfterResult(result /* 'profit' | 'loss' */) {
    const arr = __betLevels[mgState.level] || __betLevels[0];
    if (!arr || arr.length === 0) {
        console.warn('[MG] Invalid bet array, resetting to step 0');
        mgState.step = 0;
        return;
    }

    if (result === 'profit') {
        mgState.step = 0; // Reset to first step after profit
        console.log(`[MG] Profit: Reset to step 0 (value: ${getNextStake().toFixed(2)})`);
    } else if (result === 'loss') {
        if (mgState.step < arr.length - 1) {
            mgState.step += 1; // Move to next step
        } else {
            mgState.step = 0; // Wrap to first step if at max
        }
        // Update max step for cycle
        mgState.currentMaxStep = Math.max(mgState.currentMaxStep, mgState.step);
        console.log(`[MG] Loss: Move to step ${mgState.step} (value: ${getNextStake().toFixed(2)}), currentMaxStep updated to ${mgState.currentMaxStep}`);
    }
}

// Check cycle limits and switch levels if needed
function __checkCycleLimitsAndMaybeSwitch() {
    __ensureCycleStartBalance();
    const cyclePnL = currentBalance - mgState.cycleStartBalance;
    const wLim = __winLimits[mgState.level];
    const lLim = __lossLimits[mgState.level];

    let hitType = null;
    let nextLevel = mgState.level;

    if (typeof wLim === 'number' && cyclePnL >= wLim) {
        hitType = 'win';
        nextLevel = 0; // Reset to betArray1
        console.log(`[MG] Win limit reached (PnL=${cyclePnL.toFixed(2)}), currentMaxStep=${mgState.currentMaxStep}. Reset to betArray1, step 0.`);
    } else if (typeof lLim === 'number' && cyclePnL <= lLim) {
        hitType = 'loss';
        nextLevel = __computeNextLevelAfterCycle('loss');
        console.log(`[MG] Loss limit reached (PnL=${cyclePnL.toFixed(2)}), currentMaxStep=${mgState.currentMaxStep}. Switch to betArray${nextLevel + 1}, step 0.`);
    }

    if (hitType) {
        // Record cycle history before reset
        cycleHistory.push({
            level: mgState.level,
            maxStep: mgState.currentMaxStep,
            pnl: cyclePnL,
            hitType: hitType,
            endTime: Date.now()
        });
        if (cycleHistory.length > 20) cycleHistory.shift(); // Limit to last 20 cycles

        // Apply changes
        mgState.level = nextLevel;
        mgState.step = 0;
        mgState.currentMaxStep = 0; // Reset max step for new cycle
        mgState.cycleStartBalance = currentBalance;
    }
}

let priceHistory = [];
let candlePrices = [];
let lastCandleTime = getStartOfMinute(Date.now());
let startBalance = 0;
let currentBalance = 0;
let globalPrice = 0;
let symbolName = "";
let startTime = new Date();
let emaValues = [];
let rsiValues = [];
let macdLineValues = [];
let macdSignalValues = [];
let signalsUp = 0;
let signalsDown = 0;
let tradeHistory = [];
let lastTradeResult = null;
let totalProfit = 0;
let totalLoss = 0;
let winRate = 0;

// Система контроля состояния сделок
let tradeState = {
    active: false,
    direction: null,
    startTime: 0,
    startBalance: 0,
    startPrice: 0,
    resultRecorded: false,
    checkAttempts: 0
};

// == Настройки горячих клавиш ==
const Hotkeys = {
    BUY: { keyCode: 87, shiftKey: true },  // Shift+W
    SELL: { keyCode: 83, shiftKey: true }, // Shift+S
    INCREASE: { keyCode: 68, shiftKey: true }, // Shift+D
    DECREASE: { keyCode: 65, shiftKey: true }  // Shift+A
};

// == Вспомогательные функции ==
function getStartOfMinute(timestamp) {
    const date = new Date(timestamp);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.getTime();
}

function humanTime(time) {
    let date = new Date(time);
    return date.toLocaleTimeString();
}

// == Функции для расчета индикаторов ==
function calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
}

function calculateRSI(prices, period) {
    if (prices.length < period + 1) return null;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) - change) / period;
        }
    }
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// === MACD Calculation ===
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) return { macd: null, signal: null };
    
    const emaFast = calculateEMA(prices, fastPeriod);
    const emaSlow = calculateEMA(prices, slowPeriod);
    
    if (emaFast === null || emaSlow === null) return { macd: null, signal: null };
    
    const macdLine = emaFast - emaSlow;
    
    // For signal line, we need historical MACD values, but since we're calculating on full history,
    // assume we push to macdLineValues and calculate signal on accumulated macd lines.
    // However, for simplicity, if we have enough data, compute full MACD history.
    
    // Better: compute MACD line for the entire history if needed, but since updateIndicators is called on closed candles,
    // we'll accumulate macdLineValues and compute signal as EMA on macdLineValues.
    
    return { macd: macdLine, signal: null }; // Placeholder, actual in updateIndicators
}


// == Volatility & noise filter helpers ==
function estimateTickSize() {
    try {
        // Use recent priceHistory deltas to estimate minimal positive increment
        if (!Array.isArray(priceHistory) || priceHistory.length < 10) {
            // Fallback: infer from decimals in current price
            const s = String(globalPrice||0);
            if (s.includes('.')) {
                const dec = s.split('.')[1].length;
                return Math.pow(10, -dec);
            }
            return 0.00001; // generic fallback
        }
        let minPos = Infinity;
        for (let i = 1; i < priceHistory.length; i++) {
            const d = Math.abs(priceHistory[i] - priceHistory[i-1]);
            if (d > 1e-12 && d < minPos) minPos = d;
        }
        if (!isFinite(minPos) || minPos === Infinity) {
            // Fallback to decimal inference
            const s = String(globalPrice||0);
            if (s.includes('.')) {
                const dec = s.split('.')[1].length;
                return Math.pow(10, -dec);
            }
            return 0.00001;
        }
        return minPos;
    } catch(e) { return 0.00001; }
}

function calculateATRFromCandles(candles, period) {
    try {
        if (!Array.isArray(candles) || candles.length < period + 1) return null;
        // Build TR series from completed candles
        let trs = [];
        for (let i = 1; i < candles.length; i++) {
            const c = candles[i];
            const p = candles[i-1];
            const tr = Math.max(
                c.high - c.low,
                Math.abs(c.high - p.close),
                Math.abs(c.low - p.close)
            );
            trs.push(tr);
        }
        if (trs.length < period) return null;
        // Wilder's smoothing
        let atr = 0;
        for (let i = 0; i < period; i++) atr += trs[i];
        atr /= period;
        for (let i = period; i < trs.length; i++) {
            atr = (atr * (period - 1) + trs[i]) / period;
        }
        return atr;
    } catch(e) { return null; }
}

function calculateStdTicksFromCloses(candles, period, tick) {
    try {
        if (!Array.isArray(candles) || candles.length < period + 1 || !tick) return null;
        let rets = [];
        for (let i = candles.length - period - 1; i < candles.length - 1; i++) {
            const r = (candles[i+1].close - candles[i].close);
            rets.push(r / tick);
        }
        const n = rets.length;
        if (n <= 1) return null;
        const mean = rets.reduce((a,b)=>a+b,0)/n;
        let s2 = 0;
        for (let i = 0; i < n; i++) {
            const d = rets[i] - mean;
            s2 += d*d;
        }
        const variance = s2 / (n - 1);
        return Math.sqrt(variance);
    } catch(e) { return null; }
}

function evaluateFilters(currentPrice, currentEMA) {
    const tick = estimateTickSize();
    const closed = (candlePrices.length > 1) ? candlePrices.slice(0, -1) : [];
    // ATR in ticks
    const atr = calculateATRFromCandles(closed, atrPeriod);
    const atrTicks = (atr != null && tick) ? (atr / tick) : null;
    // Std of returns (in ticks)
    const stdTicks = calculateStdTicksFromCloses(closed, stdPeriod, tick);
    // Distance to EMA
    const dist = (typeof currentPrice === 'number' && typeof currentEMA === 'number') ? Math.abs(currentPrice - currentEMA) : null;
    const distTicks = (dist != null && tick) ? (dist / tick) : null;
    // Narrow range check over last N completed bars
    let rangeTicks = null;
    if (closed.length >= narrowRangeBars) {
        let hi = -Infinity, lo = Infinity;
        for (let i = closed.length - narrowRangeBars; i < closed.length; i++) {
            const c = closed[i];
            if (c.high > hi) hi = c.high;
            if (c.low  < lo) lo = c.low;
        }
        const rng = (hi - lo);
        rangeTicks = tick ? (rng / tick) : null;
    }
    // Pass/fail
    const passATR = (atrTicks != null) ? (atrTicks >= minATRTicks) : false;
    const passSTD = (stdTicks != null) ? (stdTicks >= minSTDTicks) : false;
    const passDist = (distTicks != null) ? (distTicks >= minDistanceEMATicks) : false;
    const passRange = (rangeTicks != null) ? (rangeTicks > narrowRangeMaxTicks) : false; // must be broader than threshold
    
    const pass = !!(passATR && passSTD && passDist && passRange);
    return {
        pass, tick, atr, atrTicks, stdTicks, dist, distTicks, rangeTicks,
        reasons: {
            passATR, passSTD, passDist, passRange
        }
    };
}
function updateIndicators() {
    if (candlePrices.length < emaPeriod) return;
    
    const closePrices = candlePrices.map(c => c.close);
    
    const currentEMA = calculateEMA(closePrices, emaPeriod);
    if (currentEMA !== null) {
        emaValues.push(currentEMA);
        if (emaValues.length > 100) emaValues.shift();
    }
    
    if (candlePrices.length >= rsiPeriod + 1) {
        const currentRSI = calculateRSI(closePrices, rsiPeriod);
        if (currentRSI !== null) {
            rsiValues.push(currentRSI);
            if (rsiValues.length > 100) rsiValues.shift();
        }
    }
    
    // MACD calculation
    if (candlePrices.length >= 26) {  // Minimum for EMA26
        const ema12 = calculateEMA(closePrices, 12);
        const ema26 = calculateEMA(closePrices, 26);
        const currentMACD = ema12 - ema26;
        macdLineValues.push(currentMACD);
        if (macdLineValues.length > 100) macdLineValues.shift();
        
        if (macdLineValues.length >= 9) {
            const currentSignal = calculateEMA(macdLineValues, 9);
            macdSignalValues.push(currentSignal);
            if (macdSignalValues.length > 100) macdSignalValues.shift();
        }
    }
}

// == Функции для работы с данными ==
function initData() {
    try {
        const symbolDiv = document.getElementsByClassName("current-symbol")[0];
        const balanceDiv = mode === 'REAL' 
            ? document.getElementsByClassName("js-hd js-balance-real-USD")[0]
            : document.getElementsByClassName("js-hd js-balance-demo")[0];
        
        if (symbolDiv) symbolName = symbolDiv.textContent.replace("/", " ").trim();
        if (balanceDiv) {
            let balanceText = balanceDiv.innerHTML.replace(/,/g, '');
            startBalance = parseFloat(balanceText) || 0;
            currentBalance = startBalance;
        }
        
        console.log(`Bot initialized. Symbol: ${symbolName}, Start balance: ${startBalance.toFixed(2)}`);
        startTime = new Date();
    } catch (e) {
        console.error("Error in initData:", e);
    }
}

function getCurrentPrice() {
    try {
        const targetElement = findPriceElement();
        if (!targetElement) return 0;
        
        const text = targetElement.innerHTML;
        const priceMatch = text.match(/\d+\.\d+(?=\ a)/g);
        return priceMatch ? parseFloat(priceMatch[0]) : 0;
    } catch (e) {
        console.error("Error getting price:", e);
        return 0;
    }
}

function findPriceElement() {
    try {
        const targetElements = document.getElementsByClassName("tooltip-text");
        const textToSearch = "Winnings amount you receive";
        
        for (let i = 0; i < targetElements.length; i++) {
            let textContent = targetElements[i].textContent || targetElements[i].innerText;
            if (textContent.includes(textToSearch)) {
                return targetElements[i];
            }
        }
        return null;
    } catch (e) {
        console.error("Error finding price element:", e);
        return null;
    }
}

// == Функции для работы со свечами ==
function createNewCandle(price, time) {
    return {
        time: time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1
    };
}

function updateCurrentCandle(price) {
    if (candlePrices.length === 0) return;
    
    let currentCandle = candlePrices[candlePrices.length - 1];
    currentCandle.high = Math.max(currentCandle.high, price);
    currentCandle.low = Math.min(currentCandle.low, price);
    currentCandle.close = price;
    currentCandle.volume++;
}


// === Simple Candlestick Renderer ===
function renderCandleChart() {
    try {
        const canvas = document.getElementById('bot-candle-canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const cssW = Math.max(260, rect.width || 300);
        const cssH = Math.max(150, rect.height || 240);
        if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
            canvas.width = Math.floor(cssW * dpr);
            canvas.height = Math.floor(cssH * dpr);
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);

        const N = Math.min(60, candlePrices.length);
        safeUpdateElement('ui-chart-info', N > 0 ? (N + ' bars') : '—');
        if (N === 0) return;
        const data = candlePrices.slice(-N);
        const highs = data.map(c => c.high);
        const lows  = data.map(c => c.low);
        const maxH = Math.max.apply(null, highs);
        const minL = Math.min.apply(null, lows);
        const pad = (maxH - minL) * 0.05 || 0.0001;
        const top = maxH + pad;
        const bot = minL - pad;
        const yScale = (v) => {
            const t = (v - bot) / (top - bot);
            return cssH - t * cssH;
        };
        const w = cssW / N;

        // grid
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const y = Math.round((cssH/5) * i) + 0.5;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssW, y); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // candles
        for (let i = 0; i < N; i++) {
            const c = data[i];
            const x = i * w + 0.5;
            const openY = yScale(c.open);
            const closeY = yScale(c.close);
            const highY = yScale(c.high);
            const lowY  = yScale(c.low);
            const up = c.close >= c.open;
            ctx.strokeStyle = up ? '#2ecc71' : '#e74c3c';
            ctx.fillStyle = up ? '#2ecc71' : '#e74c3c';
            // wick
            ctx.beginPath();
            ctx.moveTo(x + w*0.5, highY);
            ctx.lineTo(x + w*0.5, lowY);
            ctx.stroke();
            // body
            const bodyTop = Math.min(openY, closeY);
            const bodyH = Math.max(2, Math.abs(closeY - openY));
            ctx.globalAlpha = 0.9;
            ctx.fillRect(Math.round(x + w*0.15), Math.round(bodyTop), Math.max(1, Math.round(w*0.7)), Math.round(bodyH));
            ctx.globalAlpha = 1;
        }
    } catch (e) {
        console.error('renderCandleChart error:', e);
    }
}
function checkCandles(currentTime) {
// Minute alignment: wait for exact minute start before forming first candle
try {
    const now = currentTime || Date.now();
    if (!candleSyncReady) {
        if (!candleSyncTarget) candleSyncTarget = Math.floor(now/60000)*60000 + 60000;
        const remaining = Math.max(0, candleSyncTarget - now);
        const waited = 60000 - remaining;
        const pct = Math.max(0, Math.min(100, (waited / 60000) * 100));
        const bar = document.getElementById('ui-candle-progress-bar'); if (bar) bar.style.width = pct.toFixed(1) + '%';
        safeUpdateElement('ui-candle-progress', `Sync to minute: ${Math.ceil(remaining/1000)}s`);
        if (remaining <= 0) {
            // Start exactly at minute boundary
            try { candlePrices.length = 0; } catch(e) {}
            lastCandleTime = candleSyncTarget;
            const firstMinuteStart = candleSyncTarget;
            const newCandle = createNewCandle(globalPrice, firstMinuteStart);
            candlePrices.push(newCandle);
            while (candlePrices.length > MAX_M1_CANDLES) { candlePrices.shift(); }
            try{ persistCandlesM1(); }catch(e){}

            candleSyncReady = true;
            safeUpdateElement('ui-candle-progress', 'Candle progress:');
            renderCandleChart();
        } else {
            return; // do not form/update candles yet
        }
    }
} catch(e) {}

    try {
        const currentMinuteStart = getStartOfMinute(currentTime);
        
        if (currentMinuteStart > lastCandleTime) {
            if (candlePrices.length > 0) {
                logCandle(candlePrices[candlePrices.length - 1]);
                updateIndicators();
            }
            
            const newCandle = createNewCandle(globalPrice, currentMinuteStart);
            candlePrices.push(newCandle);
            while (candlePrices.length > MAX_M1_CANDLES) { candlePrices.shift(); }
            try{ persistCandlesM1(); }catch(e){}

            renderCandleChart();
            
            if (candlePrices.length > 100) {
                candlePrices.shift();
            }
            
            lastCandleTime = currentMinuteStart;
            renderCandleChart();
        } else if (candlePrices.length > 0) {
            updateCurrentCandle(globalPrice);
            try { const pct = ((currentTime % 60000) / 60000) * 100; const bar = document.getElementById('ui-candle-progress-bar'); if (bar) bar.style.width = pct.toFixed(1) + '%'; } catch(e){}
            renderCandleChart();
        } else {
            const newCandle = createNewCandle(globalPrice, currentMinuteStart);
            candlePrices.push(newCandle);
            while (candlePrices.length > MAX_M1_CANDLES) { candlePrices.shift(); }
            try{ persistCandlesM1(); }catch(e){}

            renderCandleChart();
            lastCandleTime = currentMinuteStart;
            renderCandleChart();
        }
    } catch (e) {
        console.error("Error in checkCandles:", e);
    }
}

function logCandle(candle) {
    try {
        const time = new Date(candle.time).toLocaleTimeString();
        const direction = candle.close > candle.open ? '↑' : '↓';
        const color = candle.close > candle.open ? 'green' : 'red';
        const changePercent = ((candle.close - candle.open) / candle.open * 100).toFixed(2);
        
        const lastEMA = emaValues.length > 0 ? emaValues[emaValues.length - 1].toFixed(5) : '-';
        const lastRSI = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1].toFixed(2) : '-';
        
        console.log(
            `%c${time} ${direction} O:${candle.open.toFixed(5)} H:${candle.high.toFixed(5)} L:${candle.low.toFixed(5)} C:${candle.close.toFixed(5)} (${changePercent}%) V:${candle.volume} ` +
            `EMA(${emaPeriod}):${lastEMA} RSI(${rsiPeriod}):${lastRSI}`,
            `color: ${color}`
        );
    } catch (e) {
        console.error("Error in logCandle:", e);
    }
}

// == Функции торговли и отслеживания результатов ==
function executeTrade(direction) {
    if (tradeState.active) {
        console.log("Trade blocked: another trade in progress");
        return;
    }
    
    try {
        // Фиксируем начальное состояние
        tradeState = {
            active: true,
            direction: direction,
            startTime: Date.now(),
            startBalance: currentBalance,
            startPrice: globalPrice,
            resultRecorded: false,
            checkAttempts: 0
        };
__ensureCycleStartBalance();
tradeState.stake = getNextStake();

        
        // Установка экспирации
        setExpiryTime();

        // Установка суммы ставки через имитацию клавиш, затем исполнение заказа
        setStakeByKeysForCurrentStep(() => {
            const keyEvent = direction === 'UP' ? Hotkeys.BUY : Hotkeys.SELL;
            document.dispatchEvent(new KeyboardEvent('keydown', keyEvent));
            document.dispatchEvent(new KeyboardEvent('keyup', keyEvent));
            console.log(`REAL Trade executed: ${direction} at ${globalPrice}, Balance: ${currentBalance.toFixed(2)}`);
            // Запускаем проверку результата
            setTimeout(() => { checkTradeResult(); }, expiryTime * 60000 + 2000);
        });
 // Проверка через 2 сек после экспирации
    } catch (e) {
        console.error('Trade execution error:', e);
        tradeState.active = false;
    }
}

function setExpiryTime() {
    try {
        const expiryButtons = document.querySelectorAll('.expiry-button, .digi-expiry-button');
        if (expiryButtons.length >= expiryTime) {
            expiryButtons[expiryTime - 1].click();
        }
    } catch (e) {
        console.error("Error in setExpiryTime:", e);
    }
}

function checkTradeResult() {
    if (!tradeState.active || tradeState.resultRecorded) return;
    
    try {
        tradeState.checkAttempts++;
        updateBalance(); // Обновляем баланс
        
        const currentTime = Date.now();
        const timeSinceTrade = currentTime - tradeState.startTime;
        const minTradeDuration = expiryTime * 60000 * 0.8; // 80% от времени экспирации
        
        // Проверяем, что прошло достаточно времени
        if (timeSinceTrade < minTradeDuration) {
            if (tradeState.checkAttempts < 5) {
                setTimeout(checkTradeResult, 5000);
            } else {
                console.log("Trade check timeout - insufficient duration");
                tradeState.active = false;
            }
            return;
        }
        
        const difference = currentBalance - tradeState.startBalance;
        const minExpectedChange = (tradeState.stake != null ? tradeState.stake : __betLevels[0][0].value) * 0.8; // 80% от суммы ставки
        
        // Проверяем значимое изменение баланса
        if (Math.abs(difference) >= minExpectedChange) {
            const result = difference > 0 ? 'profit' : 'loss';
            recordTradeResult(result, difference);
        } else {
            // Если изменение незначительное, проверяем еще раз (макс 5 попыток)
            if (tradeState.checkAttempts < 5) {
                setTimeout(checkTradeResult, 5000);
            } else {
                console.log("Trade result unclear after maximum attempts");
                tradeState.active = false;
            }
        }
    } catch (e) {
        console.error("Error in checkTradeResult:", e);
        tradeState.active = false;
    }
}


function recordTradeResult(result, amount) {
    try {
        if (tradeState.resultRecorded) return;
        
        const trade = {
            time: Date.now(),
            direction: tradeState.direction,
            result: result,
            amount: Math.abs(amount),
            balance: currentBalance,
            price: tradeState.startPrice,
            endPrice: globalPrice
        };
        
        tradeHistory.push(trade);
        if (tradeHistory.length > 100) tradeHistory.shift();
        
        if (result === 'profit') {
            totalProfit += amount;
        } else {
            totalLoss += Math.abs(amount);
        }
        
        // Обновляем статистику
        const profitableTrades = tradeHistory.filter(t => t.result === 'profit').length;
        winRate = tradeHistory.length > 0 ? (profitableTrades / tradeHistory.length * 100) : 0;
        
        lastTradeResult = {
            result: result,
            amount: amount,
            time: trade.time
        };
// === Martingale state update + cycle limit checks ===
try {
    __updateMartingaleAfterResult(result);
    __checkCycleLimitsAndMaybeSwitch();
// === Trade result logging (PnL + Next Stake with step & cycle) ===
(function(){ try {
    const __pnl = Number(amount) || 0;
    // Next stake *after* martingale update
    let __nextStake = (typeof getNextStake === 'function') ? getNextStake({ lastResult: result, lastAmount: Math.abs(__pnl) }) :
                       (typeof __betLevels[0][0].value !== 'undefined' ? __betLevels[0][0].value : null);
    // Human-readable cycle name
    const __cycleName = `betArray${(mgState && typeof mgState.level === 'number') ? (mgState.level + 1) : 1}`;
    const __stepIndex = (mgState && typeof mgState.step === 'number') ? mgState.step : 0;
    if (typeof __nextStake === 'number') {
        console.log(`[TRADE-RESULT] PnL=${__pnl.toFixed(2)}; NextStake=${__nextStake.toFixed(2)} (step: ${__stepIndex}, ${__cycleName})`);
    } else if (__nextStake != null) {
        console.log(`[TRADE-RESULT] PnL=${__pnl.toFixed(2)}; NextStake=${__nextStake} (step: ${__stepIndex}, ${__cycleName})`);
    } else {
        console.log(`[TRADE-RESULT] PnL=${__pnl.toFixed(2)}; NextStake=UNKNOWN (step: ${__stepIndex}, ${__cycleName})`);
    }
} catch(e) { /* logging only */ } })();
// === End trade result logging ===

} catch(e) { /* mg update failed silently */ }

        
        console.log(`CONFIRMED ${result.toUpperCase()}: $${Math.abs(amount).toFixed(2)} | Balance: ${tradeState.startBalance.toFixed(2)} → ${currentBalance.toFixed(2)}`);
        
        // Сбрасываем состояние
        tradeState.resultRecorded = true;
        tradeState.active = false;
    } catch (e) {
        console.error("Error in recordTradeResult:", e);
    }
}

function checkTradingConditions() {
    try {
        if (tradeState.active || candlePrices.length < emaPeriod + 1 || emaValues.length < 2 || rsiValues.length < 2) {
            return;
        }
        
        const currentPrice = globalPrice;
        const currentEMA = emaValues[emaValues.length - 1];
        const prevEMA = emaValues[emaValues.length - 2];
        const currentRSI = rsiValues[rsiValues.length - 1];
        const prevRSI = rsiValues[rsiValues.length - 2];

        // Noise filters
        try {
            const __f = evaluateFilters(currentPrice, currentEMA);
            window.__L05_lastFilters = __f;
            if (!__f.pass) { return; }
        } catch(e) {}

        // MACD conditions
        if (macdLineValues.length < 2 || macdSignalValues.length < 2) {
            return; // Not enough MACD data
        }
        const currentMACD = macdLineValues[macdLineValues.length - 1];
        const prevMACD = macdLineValues[macdLineValues.length - 2];
        const currentSignal = macdSignalValues[macdSignalValues.length - 1];
        const prevSignal = macdSignalValues[macdSignalValues.length - 2];

        const macdCrossUp = prevMACD <= prevSignal && currentMACD > currentSignal;
        const macdCrossDown = prevMACD >= prevSignal && currentMACD < currentSignal;

        if (currentPrice > currentEMA && prevRSI < 30 && currentRSI > 30 && macdCrossUp) {
            signalsUp++;
            executeTrade('UP');
        }
        else if (currentPrice < currentEMA && prevRSI > 70 && currentRSI < 70 && macdCrossDown) {
            signalsDown++;
            executeTrade('DOWN');
        }
    } catch (e) {
        console.error("Error in checkTradingConditions:", e);
    }
}

// == Основной цикл ==
function mainLoop() {
      // stale price watchdog (re-scan if no updates > 5s)
  if (typeof __lastPriceTs === 'number' && Date.now() - __lastPriceTs > 5000) {
    const prev = (typeof globalPrice === 'number') ? globalPrice : null;
    __priceNode = __scanPriceNode();
    __attachPriceObserver(__priceNode);
    const now = __priceNode ? __parseFirstFloat(__priceNode.textContent || __priceNode.innerText || '') : null;
    if (typeof now === 'number' && isFinite(now)) {
      globalPrice = now;
      __lastPriceTs = Date.now();
    } else {
      try { window.dispatchEvent(new Event('resize')); } catch(e){}
      try { document.body.offsetHeight; } catch(e){}
    }
  }
try {
        const currentTime = Date.now();
        
        globalPrice = getCurrentPrice();
        if (globalPrice !== 0) {
            priceHistory.push(globalPrice);
            if (priceHistory.length > 500) priceHistory.shift();
        }
        
        updateBalance();
        checkCandles(currentTime);
        
        // Проверяем "зависшие" сделки
        if (tradeState.active && !tradeState.resultRecorded) {
            const timeSinceTrade = currentTime - tradeState.startTime;
            if (timeSinceTrade > expiryTime * 60000 * 2) { // 2x времени экспирации
                console.log("Clearing stuck trade state");
                tradeState.active = false;
            }
        }
        
        checkTradingConditions();
        updateUI(currentTime);
    } catch (e) {
        console.error("Error in mainLoop:", e);
    }
}

function updateBalance() {
    try {
        const balanceDiv = mode === 'REAL' 
            ? document.getElementsByClassName("js-hd js-balance-real-USD")[0]
            : document.getElementsByClassName("js-hd js-balance-demo")[0];
        if (balanceDiv) {
            let balanceText = balanceDiv.innerHTML.replace(/,/g, '');
            currentBalance = parseFloat(balanceText) || currentBalance;
if (botStartBalance == null && !isNaN(currentBalance)) {
    botStartBalance = currentBalance;
    if (mgState && mgState.cycleStartBalance == null) mgState.cycleStartBalance = currentBalance;
    console.log(`[MG] Start balance set: ${botStartBalance.toFixed(2)}`);
}

        }
    } catch (e) {
        console.error("Error updating balance:", e);
    }
}

// == Пользовательский интерфейс ==
function addUI() {
    try {
        const oldPanel = document.getElementById('bot-info-panel');
        if (oldPanel) oldPanel.remove();
        
        const panel = document.createElement('div');
        panel.id = 'bot-info-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            z-index: 10000;
            width: 100%;
            max-height: 300px;
            background: rgba(30, 30, 30, 0.97);
            color: white;
            padding: 10px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            border-top: 1px solid #444;
            overflow-y: auto;
            box-sizing: border-box;
        `;
        
        
panel.innerHTML = `
  <div style="display:flex; gap:10px; align-items:flex-start;">
    <!-- Left: chart only -->
    <div style="flex:0 0 33%; min-width:260px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="color:#ddd;">Bot Candles</strong>
        <small id="ui-chart-info" style="color:#aaa;">—</small>
      </div>
      <canvas id="bot-candle-canvas" style="width:100%; height:240px; background:#111; border-radius:6px;"></canvas>
    </div>

    <!-- Right: compact info + controls -->
    <div style="flex:1;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <h3 style="margin:0; color:#aaa;">${appversion}</h3>
        <div id="ui-time" style="color:#ccc;">00:00:00</div>
      </div>

      <!-- Top metrics -->
      <div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; margin-bottom:8px;">
        <div><strong>Symbol:</strong> <span id="ui-symbol">-</span></div>
        <div><strong>Price:</strong> <span id="ui-price">0.00000</span></div>
        <div><strong>EMA(${typeof emaPeriod!=='undefined'?emaPeriod:'-' }):</strong> <span id="ui-ema">-</span></div>
        <div><strong>RSI(${typeof rsiPeriod!=='undefined'?rsiPeriod:'-' }):</strong> <span id="ui-rsi">-</span></div>
        <div><strong>Start Balance:</strong> <span id="ui-start-balance">-</span></div>
        <div><strong>Balance:</strong> <span id="ui-balance">-</span></div>
        <div><strong>Total Profit:</strong> <span id="ui-total-profit">-</span></div>
        <div><strong>Total Loss:</strong> <span id="ui-total-loss">-</span></div>
        <div><strong>Trades:</strong> <span id="ui-trades-count">0</span></div>
        <div><strong>Wins:</strong> <span id="ui-wins-count">0</span></div>
        <div><strong>Losses:</strong> <span id="ui-losses-count">0</span></div>
        <div><strong>Hit Rate:</strong> <span id="ui-hit-rate">0%</span></div>
        <div><strong>Wager (Σ bets):</strong> <span id="ui-wager">0.00</span></div>
        <div><strong>ATR:</strong> <span id="ui-atr">-</span></div>
        <div><strong>STD:</strong> <span id="ui-std">-</span></div>
        <div><strong>Tick:</strong> <span id="ui-tick">-</span></div>
        <div><strong>|P-EMA|:</strong> <span id="ui-dist">-</span></div>
        <div><strong>Range(N):</strong> <span id="ui-rangeN">-</span></div>
        <div><strong>Filters:</strong> <span id="ui-filters">-</span></div>
      </div>

      <!-- Cycle History -->
      <div style="margin-top:8px; background:#222; padding:6px; border-radius:4px; max-height:120px; overflow-y:auto;">
        <strong style="color:#ddd;">Cycle History (last 10):</strong>
        <div id="ui-cycle-history" style="margin-top:4px; font-size:11px; color:#bbb;">No cycles yet</div>
      </div>

      <!-- Controls moved here -->
      <div style="display:flex; align-items:center; gap:8px; margin-top:2px; flex-wrap:wrap;">
        <label style="color:#ccc;">TF
          <select id="ui-tf" style="margin-left:4px;">
            <option value="1m">1m</option>
            <option value="5m">5m</option>
          </select>
        </label>
        <label style="color:#ccc;">Zoom
          <input type="range" id="ui-zoom" min="20" max="240" value="60" style="vertical-align:middle;">
        </label>
        <label style="color:#ccc; flex:1;">Scroll
          <input type="range" id="ui-scroll" min="0" max="0" value="0" style="width:100%; vertical-align:middle;">
        </label>
        <button id="ui-scroll-end" style="padding:2px 6px;">Live</button>
      </div>
    </div>
  </div>
`;


        
        document.body.appendChild(panel);
        if(!window.__L05_wired){
          const tfSel=document.getElementById('ui-tf'); if(tfSel) tfSel.addEventListener('change',e=>{ chartTimeframe=e.target.value; chartOffset=0; renderCandleChart(); });
          const zoom=document.getElementById('ui-zoom'); if(zoom) zoom.addEventListener('input',e=>{ chartBars=Math.max(CHART_ZOOM_MIN, Math.min(CHART_ZOOM_MAX, parseInt(e.target.value||60))); renderCandleChart(); });
          const scroll=document.getElementById('ui-scroll'); if(scroll) scroll.addEventListener('input',e=>{ chartOffset=Math.max(0, parseInt(e.target.value||0)); renderCandleChart(); });
          const btn=document.getElementById('ui-scroll-end'); if(btn) btn.addEventListener('click',()=>{ chartOffset=0; renderCandleChart(); });
          window.__L05_wired = true;
        }
        // Initialize candle sync to next minute
        try { const now = Date.now(); candleSyncTarget = Math.floor(now/60000)*60000 + 60000; candleSyncReady = false; } catch(e){}
        setTimeout(renderCandleChart, 50);
        window.addEventListener('resize', () => { try { renderCandleChart(); } catch(e){} });
    } catch (e) {
        console.error("Error in addUI:", e);
    }
}

function updateCycleHistoryUI() {
    const historyEl = document.getElementById('ui-cycle-history');
    if (!historyEl || !Array.isArray(cycleHistory) || cycleHistory.length === 0) {
        if (historyEl) historyEl.innerHTML = 'No cycles yet';
        return;
    }
    // Show last 10 cycles
    const recent = cycleHistory.slice(-10).reverse(); // Newest first
    let html = '';
    recent.forEach((c, i) => {
        const cycleNum = cycleHistory.length - recent.length + i + 1;
        const arrayName = `betArray${c.level + 1}`;
        const pnlSign = c.pnl >= 0 ? '+' : '';
        const hitColor = c.hitType === 'win' ? '#4CAF50' : '#F44336';
        html += `<div style="margin-bottom:2px;">Cycle ${cycleNum}: ${arrayName}, MaxStep ${c.maxStep}, PnL ${pnlSign}${c.pnl.toFixed(2)}, Hit: <span style="color:${hitColor};">${c.hitType.toUpperCase()}</span> (${new Date(c.endTime).toLocaleTimeString()})</div>`;
    });
    historyEl.innerHTML = html;
}

function updateUI(currentTime) {
    try {
        if (!document.getElementById('ui-symbol')) {
            addUI();
            return;
        }
        
        // Основная информация
        safeUpdateElement('ui-symbol', symbolName);
        safeUpdateElement('ui-price', globalPrice.toFixed(5));
        safeUpdateElement('ui-balance', currentBalance.toFixed(2));
        safeUpdateElement('ui-profit', (currentBalance - startBalance).toFixed(2));
        safeUpdateElement('ui-start-balance', startBalance.toFixed(2));
        safeUpdateElement('ui-start-time', startTime.toLocaleTimeString());
        safeUpdateElement('ui-candles', candlePrices.length);
        safeUpdateElement('ui-time', humanTime(currentTime));
        
        // Индикаторы
        const lastEMA = emaValues.length > 0 ? emaValues[emaValues.length - 1] : null;
        const lastRSI = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;
        
        safeUpdateElement('ui-ema', lastEMA ? lastEMA.toFixed(5) : '-');
        safeUpdateElement('ui-rsi', lastRSI ? lastRSI.toFixed(2) : '-');
        
        // Цвета для EMA
        const emaElement = document.getElementById('ui-ema');
        if (emaElement) {
            if (lastEMA !== null) {
                emaElement.style.color = globalPrice > lastEMA ? '#2196F3' : '#F44336';
            } else {
                emaElement.style.color = '#9E9E9E';
            }
        }
        
        // Цвета для RSI
        const rsiElement = document.getElementById('ui-rsi');
        if (rsiElement && lastRSI !== null) {
            if (lastRSI > 70) rsiElement.style.color = '#F44336';
            else if (lastRSI < 30) rsiElement.style.color = '#4CAF50';
            else rsiElement.style.color = '#FFC107';
        }
        
        // Объем последней свечи
        if (candlePrices.length > 0) {
            safeUpdateElement('ui-volume', candlePrices[candlePrices.length - 1].volume);
        }
        
        // Счетчики сигналов
        safeUpdateElement('ui-signals-up', signalsUp);
        safeUpdateElement('ui-signals-down', signalsDown);
        
        // Статистика сделок
        safeUpdateElement('ui-total-profit', totalProfit.toFixed(2));
        safeUpdateElement('ui-total-loss', totalLoss.toFixed(2));
        safeUpdateElement('ui-hit-rate', winRate.toFixed(1) + '%');
        safeUpdateElement('ui-trades-count', tradeHistory.length);
        // === Noise filter metrics UI ===
        try {
            const f = (typeof window.__L05_lastFilters === 'object') ? window.__L05_lastFilters : evaluateFilters(
                globalPrice,
                (emaValues.length>0 ? emaValues[emaValues.length-1] : null)
            );
            const tick = f && f.tick ? f.tick : null;
            const atrTicks = f && (typeof f.atrTicks === 'number') ? f.atrTicks : null;
            const stdTicks = f && (typeof f.stdTicks === 'number') ? f.stdTicks : null;
            const distTicks = f && (typeof f.distTicks === 'number') ? f.distTicks : null;
            const rangeTicks = f && (typeof f.rangeTicks === 'number') ? f.rangeTicks : null;
            safeUpdateElement('ui-atr', (f && typeof f.atr === 'number') ? f.atr.toFixed(5) + (atrTicks!=null?` (${atrTicks.toFixed(1)}t)`:``) : '-');
            safeUpdateElement('ui-std', (stdTicks!=null) ? stdTicks.toFixed(1) + 't' : '-');
            safeUpdateElement('ui-tick', (tick!=null) ? tick.toFixed(5) : '-');
            safeUpdateElement('ui-dist', (distTicks!=null) ? distTicks.toFixed(1) + 't' : '-');
            safeUpdateElement('ui-rangeN', (rangeTicks!=null) ? rangeTicks.toFixed(1) + 't' : '-');
            const ok = f && f.reasons ? (f.reasons.passATR && f.reasons.passSTD && f.reasons.passDist && f.reasons.passRange) : false;
            safeUpdateElement('ui-filters', ok ? 'PASS' : 'BLOCK');
        } catch(e) {}

        safeUpdateElement('ui-wins-count', tradeHistory.filter(t => t.result === 'profit').length);
        safeUpdateElement('ui-losses-count', tradeHistory.filter(t => t.result === 'loss').length);
        
        // Время работы
        const runtime = Math.floor((currentTime - startTime) / 1000);
        const hours = Math.floor(runtime / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((runtime % 3600) / 60).toString().padStart(2, '0');
        const seconds = (runtime % 60).toString().padStart(2, '0');
        safeUpdateElement('ui-runtime', `${hours}:${minutes}:${seconds}`);
        
        // Прогресс текущей свечи
        const timeInCurrentCandle = currentTime - lastCandleTime;
        const candleProgress = Math.min(100, (timeInCurrentCandle / candleInterval * 100)).toFixed(0);
        safeUpdateElement('ui-candle-progress', `${candleProgress}%`);
        
        const progressBar = document.getElementById('ui-candle-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${candleProgress}%`;
        }
        
        // Последняя завершенная свеча
        if (candlePrices.length > 1) {
            const lastCandle = candlePrices[candlePrices.length - 2];
            const direction = lastCandle.close > lastCandle.open ? '↑' : '↓';
            const color = lastCandle.close > lastCandle.open ? '#4CAF50' : '#F44336';
            const change = (lastCandle.close - lastCandle.open).toFixed(5);
            const changePercent = ((lastCandle.close - lastCandle.open) / lastCandle.open * 100).toFixed(2);
            
            safeUpdateElement('ui-candle-time', new Date(lastCandle.time).toLocaleTimeString());
            
            const lastCandleElement = document.getElementById('ui-last-candle');
            if (lastCandleElement) {
                lastCandleElement.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px;">
                        <div><strong>Open:</strong> ${lastCandle.open.toFixed(5)}</div>
                        <div><strong>High:</strong> ${lastCandle.high.toFixed(5)}</div>
                        <div><strong>Close:</strong> <span style="color: ${color}">${lastCandle.close.toFixed(5)} ${direction}</span></div>
                        <div><strong>Low:</strong> ${lastCandle.low.toFixed(5)}</div>
                        <div><strong>Change:</strong> <span style="color: ${color}">${change} (${changePercent}%)</span></div>
                        <div><strong>Volume:</strong> ${lastCandle.volume}</div>
                        <div><strong>EMA(${emaPeriod}):</strong> ${emaValues.length > 1 ? emaValues[emaValues.length - 2].toFixed(5) : '-'}</div>
                        <div><strong>RSI(${rsiPeriod}):</strong> ${rsiValues.length > 1 ? rsiValues[rsiValues.length - 2].toFixed(2) : '-'}</div>
                    </div>
                `;
            }
        }
        
        // Информация о последней сделке
        if (lastTradeResult) {
            const tradeTime = new Date(lastTradeResult.time).toLocaleTimeString();
            const tradeColor = lastTradeResult.direction === 'UP' ? '#4CAF50' : '#F44336';
            const resultColor = lastTradeResult.result === 'profit' ? '#4CAF50' : '#F44336';
            const resultSign = lastTradeResult.result === 'profit' ? '+' : '-';
            
            safeUpdateElement('ui-last-trade-time', tradeTime);
            
            const lastTradeElement = document.getElementById('ui-last-trade');
            if (lastTradeElement) {
                lastTradeElement.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                        <div><strong>Direction:</strong> <span style="color: ${tradeColor}">${lastTradeResult.direction}</span></div>
                        <div><strong>Amount:</strong> $${getNextStake().toFixed(2)}</div>
                        <div><strong>Expiry:</strong> ${expiryTime} min</div>
                        <div><strong>Status:</strong> ${tradeState.active ? 'In progress' : 'Completed'}</div>
                    </div>
                `;
            }
            
            const lastTradeResultElement = document.getElementById('ui-last-trade-result');
            if (lastTradeResultElement) {
                lastTradeResultElement.innerHTML = `
                    <div style="color: ${resultColor}; font-weight: bold;">
                        Result: ${lastTradeResult.result.toUpperCase()} (${resultSign}$${Math.abs(lastTradeResult.amount).toFixed(2)})
                    </div>
                `;
            }
        }
        
        // Update Cycle History in UI
        updateCycleHistoryUI();
    } catch (e) {
        console.error("Error in updateUI:", e);
    }
}

function safeUpdateElement(id, value) {
    try {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    } catch (e) {
        console.error(`Error updating element ${id}:`, e);
    }
}

// == Запуск бота ==
function initBot() {
    try {
        initData();
        addUI();
        try{ loadCandlesM1(); renderCandleChart(); }catch(e){}
        setInterval(mainLoop, 1000);
        console.log("Bot started successfully");
    } catch (e) {
        console.error("Bot initialization failed:", e);
    }


// lightweight intra-minute tick to avoid "dead" candles
try {
  if (!window.__intraMinuteTickStarted) {
    window.__intraMinuteTickStarted = true;
    setInterval(() => {
      try {
        if (typeof getStartOfMinute !== 'function' || typeof updateCurrentCandle !== 'function') return;
        if (typeof globalPrice !== 'number') return;
        if (typeof lastCandleTime === 'undefined') return;
        const nowMin = getStartOfMinute(Date.now());
        if (nowMin === lastCandleTime) {
          updateCurrentCandle(globalPrice);
        }
      } catch(e){}
    }, 1000);
  }
} catch(e){}
}

if (document.readyState === 'complete') {
    initBot();
} else {
    window.addEventListener('load', initBot);
}

// === Level05: persistence & TF helpers ===
function persistCandlesM1(){
  try{
    const slim = candlePrices.slice(-MAX_M1_CANDLES);
    localStorage.setItem('bot_m1_candles', JSON.stringify(slim));
  }catch(e){}
}
function loadCandlesM1(){
  try{
    const raw = localStorage.getItem('bot_m1_candles');
    if(!raw) return;
    const arr = JSON.parse(raw);
    if(Array.isArray(arr)){
      candlePrices.length = 0;
      for(const c of arr){
        if(c && typeof c.time==='number' && typeof c.open==='number'){
          candlePrices.push({time:c.time, open:c.open, high:c.high, low:c.low, close:c.close, volume:c.volume||0});
        }
      }
      while(candlePrices.length > MAX_M1_CANDLES) candlePrices.shift();
      if(candlePrices.length) lastCandleTime = candlePrices[candlePrices.length-1].time;
    }
  }catch(e){}
}
function buildM5FromM1(m1){
  const out=[]; if(!Array.isArray(m1)||!m1.length) return out;
  const TF=5*60000; let s=null,b=null;
  for(const c of m1){
    const t=Math.floor(c.time/TF)*TF;
    if(s===null||t!==s){ if(b) out.push(b); s=t; b={time:t,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume||0}; }
    else{ b.high=Math.max(b.high,c.high); b.low=Math.min(b.low,c.low); b.close=c.close; b.volume+=(c.volume||0); }
  }
  if(b) out.push(b); return out;
}


// === Level05: render override (zoom, scroll, TF) ===
function renderCandleChart(){
  try{
    const canvas = document.getElementById('bot-candle-canvas');
    if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(260, rect.width || 300);
    const cssH = Math.max(160, rect.height || 240);
    if(canvas.width !== Math.floor(cssW*dpr) || canvas.height !== Math.floor(cssH*dpr)){
      canvas.width = Math.floor(cssW*dpr);
      canvas.height = Math.floor(cssH*dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssW,cssH);

    const base = candlePrices.slice(-MAX_M1_CANDLES);
    const data = (chartTimeframe==='5m') ? buildM5FromM1(base) : base;

    const maxOffset = Math.max(0, data.length - chartBars);
    if (chartOffset > maxOffset) chartOffset = maxOffset;
    const scroll = document.getElementById('ui-scroll'); if (scroll){ scroll.max = String(maxOffset); if (Number(scroll.value) > maxOffset) scroll.value = String(maxOffset); }
    const zoom = document.getElementById('ui-zoom'); if (zoom){ zoom.min = String(CHART_ZOOM_MIN); zoom.max = String(CHART_ZOOM_MAX); zoom.value = String(chartBars); }
    const tfSel = document.getElementById('ui-tf'); if (tfSel) tfSel.value = chartTimeframe;

    const total = data.length;
    const start = Math.max(0, total - chartBars - chartOffset);
    const end   = Math.max(start, total - chartOffset);
    const view  = data.slice(start, end);

    const infoEl = document.getElementById('ui-chart-info');
    if (infoEl) infoEl.textContent = (chartTimeframe.toUpperCase()) + ' · ' + view.length + '/' + total + ' bars' + (chartOffset>0?' (history)':'');
    if (!view.length) return;

    const highs = view.map(c=>c.high);
    const lows  = view.map(c=>c.low);
    const maxH = Math.max.apply(null, highs);
    const minL = Math.min.apply(null, lows);
    const pad = (maxH - minL) * 0.05 || 0.0001;
    const top = maxH + pad;
    const bot = minL - pad;
    const yScale = function(v){ var t=(v-bot)/(top-bot); return cssH - t*cssH; };
    const w = cssW / view.length;

    // grid
    ctx.globalAlpha = 0.25; ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    for (var i=1;i<5;i++){ var y=Math.round((cssH/5)*i)+0.5; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cssW,y); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // candles
    for (var i2=0;i2<view.length;i2++){
      var c = view[i2];
      var x = i2*w + 0.5;
      var openY = yScale(c.open);
      var closeY = yScale(c.close);
      var highY = yScale(c.high);
      var lowY  = yScale(c.low);
      var up = c.close >= c.open;
      ctx.strokeStyle = up ? '#2ecc71' : '#e74c3c';
      ctx.fillStyle   = up ? '#2ecc71' : '#e74c3c';
      // wick
      ctx.beginPath(); ctx.moveTo(x + w*0.5, highY); ctx.lineTo(x + w*0.5, lowY); ctx.stroke();
      // body
      var bodyTop = Math.min(openY, closeY);
      var bodyH   = Math.max(2, Math.abs(closeY - openY));
      ctx.globalAlpha = 0.9;
      ctx.fillRect(Math.round(x + w*0.15), Math.round(bodyTop), Math.max(1, Math.round(w*0.7)), Math.round(bodyH));
      ctx.globalAlpha = 1;
    }
  }catch(e){ console.error('renderCandleChart (Level05) error:', e); }
}

// === Level05: extend updateUI with Win Rate ===
(function(){
  var __origUpdateUI = window.updateUI;
  window.updateUI = function(){
    if (typeof __origUpdateUI === 'function') { try{ __origUpdateUI.apply(this, arguments); }catch(e){} }
    try{
      var totalTrades = (typeof window.totalTrades!=='undefined')?window.totalTrades:(typeof window.trades!=='undefined'?window.trades:0);
      var totalWins   = (typeof window.totalWins!=='undefined')?window.totalWins:(typeof window.wins!=='undefined'?window.wins:0);
      var totalLosses = (typeof window.totalLosses!=='undefined')?window.totalLosses:(typeof window.losses!=='undefined'?window.losses:0);
      var totalProfit = (typeof window.totalProfit!=='undefined')?window.totalProfit:(typeof window.profit!=='undefined'?window.profit:0);
      var totalLoss   = (typeof window.totalLoss!=='undefined')?window.totalLoss:0;
      if (document.getElementById('ui-total-profit')) document.getElementById('ui-total-profit').textContent = (Number(totalProfit)||0).toFixed(2);
      if (document.getElementById('ui-total-loss')) document.getElementById('ui-total-loss').textContent   = (Number(totalLoss)||0).toFixed(2);
      if (document.getElementById('ui-trades-count')) document.getElementById('ui-trades-count').textContent = String(Number(totalTrades)||0);
      if (document.getElementById('ui-wins-count')) document.getElementById('ui-wins-count').textContent = String(Number(totalWins)||0);
      if (document.getElementById('ui-losses-count')) document.getElementById('ui-losses-count').textContent = String(Number(totalLosses)||0);
      var wr = (Number(totalTrades)>0)?(Number(totalWins)/Number(totalTrades)*100):0;
      if (document.getElementById('ui-hit-rate')) document.getElementById('ui-hit-rate').textContent = wr.toFixed(1)+'%';
      if (document.getElementById('ui-wager')) document.getElementById('ui-wager').textContent = (Number(window.totalWager||0)).toFixed(2);
    }catch(e){}
  };
})(); /*L05 WR*/


// === Level05: total Wager accumulator ===
(function(){
  window.totalWager = window.totalWager || 0;
  function pickAmount(){
    try{
      if (typeof window.currentStake === 'number' && isFinite(window.currentStake) && window.currentStake>0) return window.currentStake;
      if (typeof window.amount === 'number' && isFinite(window.amount) && window.amount>0) return window.amount;
      if (typeof window.tradeAmount === 'number' && isFinite(window.tradeAmount) && window.tradeAmount>0) return window.tradeAmount;
      if (window.currentBet && typeof window.currentBet.value === 'number' && window.currentBet.value>0) return window.currentBet.value;
      if (typeof window.nextStake === 'number' && isFinite(window.nextStake) && window.nextStake>0) return window.nextStake;
      if (typeof window.betAmount === 'number' && isFinite(window.betAmount) && window.betAmount>0) return window.betAmount;
    }catch(e){}
    return null;
  }
  function bump(){
    var a = pickAmount();
    if (typeof a === 'number' && isFinite(a) && a>0){
      window.totalWager = (window.totalWager||0) + a;
      var el = document.getElementById('ui-wager'); if (el) el.textContent = Number(window.totalWager).toFixed(2);
    }
  }
  var fnNames = ['placeTrade','executeTrade','openTrade','makeRealTrade','doTrade','placeOrder'];
  fnNames.forEach(function(n){
    try{
      var f = window[n];
      if (typeof f === 'function' && !f.__l05_wrapped){
        window[n] = function(){ try{ bump(); }catch(e){} return f.apply(this, arguments); };
        window[n].__l05_wrapped = true;
      }
    }catch(e){}
  });
})(); /*L05 WAGER*/

let candleSyncTarget = 0;
let candleSyncReady = false;

// === Cycle History Storage ===
let cycleHistory = [];