import { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Gift, Loader2, QrCode, Wallet, X } from 'lucide-react';
import {
  checkOrderStatus,
  createOrder,
  getChargeList,
  redeemCode,
} from '../lib/chargeApi';
import { formatBalanceAmount } from '../lib/userApi';

const MIN_AMOUNT = 7.3;
const STEP_AMOUNT = 7.3;

function estimateQuota(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '0.0000';
  return (n / MIN_AMOUNT).toFixed(4);
}

function normalizeAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < MIN_AMOUNT) return MIN_AMOUNT.toFixed(2);
  return n.toFixed(2);
}

export function RechargeModal({ isOpen, onClose, onSuccess, user }) {
  const [mode, setMode] = useState('online');
  const [payMethod, setPayMethod] = useState('alipay');
  const [loading, setLoading] = useState(false);
  const [alipayEnabled, setAlipayEnabled] = useState(true);
  const [wechatEnabled, setWechatEnabled] = useState(true);
  const [alipayAmount, setAlipayAmount] = useState(String(MIN_AMOUNT));
  const [wechatAmount, setWechatAmount] = useState(String(MIN_AMOUNT));
  const [redeemCodeValue, setRedeemCodeValue] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const pollingRef = useRef(null);

  const onlineAmount = payMethod === 'alipay' ? alipayAmount : wechatAmount;

  const availableBalance = useMemo(() => {
    const totalCoin = Number(user?.payment?.jimicoin || user?.payment?.balance || 0);
    const usedCoin = Number(user?.payment?.used_coin || user?.payment?.used_balance || 0);
    return Math.max(0, totalCoin - usedCoin).toFixed(4);
  }, [user]);

  const paymentOptions = [
    {
      key: 'alipay',
      title: '支付宝',
      subtitle: '推荐 PC 端拉起支付',
      enabled: alipayEnabled,
      icon: CreditCard,
      activeClass: 'recharge-pay-option-alipay',
    },
    {
      key: 'wechat',
      title: '微信支付',
      subtitle: '扫码支付更便捷',
      enabled: wechatEnabled,
      icon: QrCode,
      activeClass: 'recharge-pay-option-wechat',
    },
  ];

  const clearPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const resetState = () => {
    setMode('online');
    setPayMethod('alipay');
    setLoading(false);
    setAlipayAmount(String(MIN_AMOUNT));
    setWechatAmount(String(MIN_AMOUNT));
    setRedeemCodeValue('');
    setQrCode('');
    setOrderNo('');
    clearPolling();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fetchPaymentConfig = async () => {
    try {
      const res = await getChargeList();
      const payments = res?.data?.payment || [];
      const alipay = payments.find((p) => p.type === 'alipay');
      const wechat = payments.find((p) => p.type === 'wechat');
      const alipayAvailable = alipay?.enable ?? true;
      const wechatAvailable = wechat?.enable ?? true;
      setAlipayEnabled(alipayAvailable);
      setWechatEnabled(wechatAvailable);
      if (!alipayAvailable && wechatAvailable) {
        setPayMethod('wechat');
      } else {
        setPayMethod('alipay');
      }
    } catch (error) {
      console.error('获取支付配置失败:', error);
    }
  };

  const startPolling = (targetOrderNo, successText) => {
    clearPolling();
    pollingRef.current = window.setInterval(async () => {
      try {
        const res = await checkOrderStatus(targetOrderNo);
        if (res?.data?.status === 1) {
          clearPolling();
          setQrCode('');
          setOrderNo('');
          await onSuccess?.();
          window.alert(successText);
          handleClose();
        }
      } catch (error) {
        console.error('查询订单状态失败:', error);
      }
    }, 3000);
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    fetchPaymentConfig();
    return () => clearPolling();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRedeem = async () => {
    if (!redeemCodeValue.trim()) {
      window.alert('请输入兑换码');
      return;
    }
    setLoading(true);
    try {
      await redeemCode({ code: redeemCodeValue.trim() });
      await onSuccess?.();
      window.alert('兑换成功');
      handleClose();
    } catch (error) {
      window.alert(error?.message || '兑换失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCreditOrder = async () => {
    const amount = Number(onlineAmount);
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
      window.alert(`请输入不小于 ${MIN_AMOUNT} 的金额`);
      return;
    }
    setLoading(true);
    try {
      const res = await createOrder({
        pay_method: payMethod,
        amount,
        pay_env: 'web',
      });

      const code = res?.data?.qr_code || '';
      const nextOrderNo = res?.data?.order_no || '';

      if (payMethod === 'alipay' && code && String(code).startsWith('http')) {
        window.open(code, '_blank', 'noopener,noreferrer');
      } else if (code) {
        setQrCode(code);
      }

      if (nextOrderNo) {
        setOrderNo(nextOrderNo);
        startPolling(nextOrderNo, '支付成功，额度已到账');
      }
    } catch (error) {
      window.alert(error?.message || '下单失败');
    } finally {
      setLoading(false);
    }
  };

  const adjustAmount = (direction) => {
    const current = Number(onlineAmount);
    const base = Number.isFinite(current) && current >= MIN_AMOUNT ? current : MIN_AMOUNT;
    const next = direction === 'inc' ? base + STEP_AMOUNT : Math.max(MIN_AMOUNT, base - STEP_AMOUNT);
    const nextValue = next.toFixed(2);
    if (payMethod === 'alipay') {
      setAlipayAmount(nextValue);
      return;
    }
    setWechatAmount(nextValue);
  };

  const handleSelectPayMethod = (method) => {
    setPayMethod(method);
    setQrCode('');
    setOrderNo('');
  };

  const enabledPayOptions = paymentOptions.filter((option) => option.enabled);

  return (
    <div className="recharge-modal-backdrop" onPointerDown={handleClose}>
      <div
        className="recharge-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recharge-modal-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="recharge-modal-header">
          <div className="asset-modal-title">
            <span className="recharge-modal-icon">
              <Wallet size={18} aria-hidden="true" />
            </span>
            <div>
              <strong id="recharge-modal-title">充值中心</strong>
              <span>支持支付宝、微信、兑换码充值</span>
            </div>
          </div>
          <button type="button" className="icon-mini" onClick={handleClose} aria-label="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="recharge-modal-body">
          <div className="recharge-mode-tabs">
            <button
              type="button"
              className={mode === 'online' ? 'active' : ''}
              onClick={() => setMode('online')}
            >
              充值额度
            </button>
            <button
              type="button"
              className={mode === 'redeem' ? 'active' : ''}
              onClick={() => setMode('redeem')}
            >
              兑换码充值
            </button>
          </div>

          <div className="recharge-modal-grid">
            <div className="recharge-modal-main">
              {mode === 'online' ? (
                <>
                  <p className="recharge-step-label">第一步：选择支付方式</p>
                  <div
                    className={`recharge-pay-options ${
                      enabledPayOptions.length > 1 ? 'is-multi' : ''
                    }`}
                  >
                    {enabledPayOptions.map((option) => {
                      const isActive = payMethod === option.key;
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={`recharge-pay-option ${option.activeClass} ${
                            isActive ? 'is-active' : ''
                          }`}
                          onClick={() => handleSelectPayMethod(option.key)}
                        >
                          <span className="recharge-pay-option-icon">
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <span>
                            <strong>{option.title}</strong>
                            <span>{option.subtitle}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <label className="recharge-step-label">第二步：充值金额（CNY）</label>
                  <div className="recharge-amount-control">
                    <button type="button" onClick={() => adjustAmount('dec')} aria-label="减少金额">
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={onlineAmount}
                      onChange={(event) => {
                        const value = event.target.value.trim();
                        if (payMethod === 'alipay') setAlipayAmount(value);
                        else setWechatAmount(value);
                      }}
                      onBlur={() => {
                        if (payMethod === 'alipay') {
                          setAlipayAmount(normalizeAmount(alipayAmount));
                          return;
                        }
                        setWechatAmount(normalizeAmount(wechatAmount));
                      }}
                    />
                    <button type="button" onClick={() => adjustAmount('inc')} aria-label="增加金额">
                      +
                    </button>
                  </div>
                  <p className="recharge-hint">最低 7.30 CNY 起充，1 Jimicoin = 7.3 CNY</p>

                  <button
                    type="button"
                    className={`recharge-submit-button ${
                      payMethod === 'wechat' ? 'is-wechat' : 'is-alipay'
                    }`}
                    onClick={handleCreateCreditOrder}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 size={18} className="sync-chip-spin" aria-hidden="true" />
                    ) : (
                      <CreditCard size={18} aria-hidden="true" />
                    )}
                    立即支付并充值
                  </button>
                </>
              ) : null}

              {mode === 'redeem' ? (
                <>
                  <div className="recharge-redeem-head">
                    <label className="recharge-step-label">兑换码</label>
                    <span className="recharge-redeem-tip">没有兑换码？请切换上方「充值额度」</span>
                  </div>
                  <input
                    className="recharge-redeem-input"
                    value={redeemCodeValue}
                    onChange={(event) => setRedeemCodeValue(event.target.value)}
                    placeholder="请输入 12 位或 16 位兑换码"
                  />
                  <button
                    type="button"
                    className="recharge-submit-button is-redeem"
                    onClick={handleRedeem}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 size={18} className="sync-chip-spin" aria-hidden="true" />
                    ) : (
                      <Gift size={18} aria-hidden="true" />
                    )}
                    立即兑换
                  </button>
                </>
              ) : null}
            </div>

            <aside className="recharge-modal-side">
              {mode === 'online' ? (
                <div className="recharge-side-card is-highlight">
                  预计兑换额度：<strong>{estimateQuota(onlineAmount)}</strong>
                </div>
              ) : null}

              {qrCode ? (
                <div className="recharge-qr-card">
                  <p>{payMethod === 'alipay' ? '支付宝' : '微信'} 扫码支付</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCode)}`}
                    alt="支付二维码"
                    className="recharge-qr-image"
                  />
                  <span className="recharge-qr-hint">
                    <QrCode size={12} aria-hidden="true" />
                    系统会自动轮询支付状态
                  </span>
                  {orderNo ? <span className="recharge-order-no">订单号：{orderNo}</span> : null}
                </div>
              ) : null}

              <div className="recharge-side-card">
                <div className="recharge-balance-row">
                  <span>可用余额</span>
                  <strong>{formatBalanceAmount(availableBalance)}</strong>
                </div>
                <p className="recharge-side-label">说明</p>
                <ul>
                  <li>兑换比例：7.3 CNY = 1 额度。</li>
                  <li>支付成功后系统将自动刷新余额。</li>
                  <li>如遇问题，请联系客服。</li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
