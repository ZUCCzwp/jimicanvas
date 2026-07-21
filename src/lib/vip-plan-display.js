/** 与后端 chargeModel 会员赠送规则对齐 */
export const VIP_COIN_EXCHANGE_RATE = 7.3;
/** 创始会员充值吉米币 9 折（同等支付到账更多） */
export const FOUNDING_RECHARGE_DISCOUNT_RATE = 0.9;

export const GRANT_BONUS_TIERS = [
  { min: 100, rate: 0.9 },
  { min: 50, rate: 0.91 },
  { min: 20, rate: 0.93 },
  { min: 10, rate: 0.95 },
  { min: 5, rate: 0.97 },
];

export function roundCoin(n) {
  return Math.round(n * 10000) / 10000;
}

export function baseCoinFromPrice(price) {
  if (price <= 0) return 0;
  return roundCoin(price / VIP_COIN_EXCHANGE_RATE);
}

export function grantBonusPayRateForBaseCoin(baseCoin) {
  for (const tier of GRANT_BONUS_TIERS) {
    if (baseCoin >= tier.min) return tier.rate;
  }
  return 1;
}

export function grantCoinWithTieredBonus(baseCoin) {
  if (baseCoin <= 0) return 0;
  const rate = grantBonusPayRateForBaseCoin(baseCoin);
  if (rate >= 1) return roundCoin(baseCoin);
  return roundCoin(baseCoin / rate);
}

export function applyFoundingRechargeDiscount(grantCoin) {
  if (grantCoin <= 0 || FOUNDING_RECHARGE_DISCOUNT_RATE <= 0 || FOUNDING_RECHARGE_DISCOUNT_RATE >= 1) {
    return roundCoin(grantCoin);
  }
  return roundCoin(grantCoin / FOUNDING_RECHARGE_DISCOUNT_RATE);
}

export function isFoundingMember(user) {
  const vipInfo = user?.vip_info || user?.vipInfo;
  return !!(vipInfo?.is_founding_member || vipInfo?.vip_type === 'founding');
}

export function computeJimicoinCreditGrant(baseCoin, options = {}) {
  const base = roundCoin(baseCoin);
  let grantCoin;
  if (options.foundingDiscount) {
    // 创始会员：不享受阶梯加赠，仅统一 9 折
    grantCoin = applyFoundingRechargeDiscount(base);
  } else {
    grantCoin = grantCoinWithTieredBonus(base);
  }
  return { baseCoin: base, grantCoin };
}

export function formatCoinDisplay(n, decimals = 4) {
  return n.toFixed(decimals);
}
