import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { AnimatedCharacters } from './AnimatedCharacters';
import {
  fetchPublicRoles,
  login,
  register,
  sendEmailCode,
} from '../lib/userApi';

const CODE_COOLDOWN_SEC = 60;

export function AuthModal({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
  siteTitle = 'JimAI Canvas',
  siteSlogan = 'AI 画布创作平台',
  logoUrl = '',
}) {
  const [mode, setMode] = useState(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    nickname: '',
    email: '',
    verifyCode: '',
    password: '',
    confirmPassword: '',
    roleId: '',
  });

  const activePassword = mode === 'login' ? loginForm.password : registerForm.password;
  const passwordLength = activePassword.length;

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setError('');
    setIsTyping(false);
    setShowPassword(false);
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen || codeCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCodeCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, codeCooldown]);

  useEffect(() => {
    if (!isOpen || mode !== 'register') return;
    let cancelled = false;
    setRolesLoading(true);
    fetchPublicRoles()
      .then((list) => {
        if (cancelled) return;
        setRoles(list);
        if (list.length > 0) {
          setRegisterForm((prev) => ({
            ...prev,
            roleId: prev.roleId || String(list[0].id ?? list[0].ID ?? ''),
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setRoles([]);
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode]);

  const formTitle = useMemo(
    () => (mode === 'login' ? '登录到工作台' : '创建你的账号'),
    [mode]
  );

  const formSubtitle = useMemo(
    () =>
      mode === 'login'
        ? '登录后即可同步与管理画布项目'
        : '注册账号，开始 AI 画布创作',
    [mode]
  );

  if (!isOpen) return null;

  const handleSendCode = async () => {
    const email = registerForm.email.trim();
    if (!email) {
      setError('请输入邮箱');
      return;
    }
    setError('');
    try {
      await sendEmailCode(email);
      setCodeCooldown(CODE_COOLDOWN_SEC);
    } catch (err) {
      setError(err.message || '发送验证码失败');
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const username = loginForm.username.trim();
    const password = loginForm.password;
    if (!username || !password) {
      setError('请输入账号和密码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login({ username, password });
      onSuccess?.();
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const nickname = registerForm.nickname.trim();
    const email = registerForm.email.trim();
    const verifyCode = registerForm.verifyCode.trim();
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;
    const roleId = registerForm.roleId;

    if (!nickname || !email || !verifyCode || !password) {
      setError('请填写完整注册信息');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (!roleId) {
      setError('请选择角色');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await register({
        nickname,
        email,
        password,
        verify_code: verifyCode,
        role_id: Number(roleId),
      });
      onSuccess?.();
    } catch (err) {
      setError(err.message || '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setShowPassword(false);
    setIsTyping(false);
  };

  const handleTypingFocus = () => setIsTyping(true);
  const handleTypingBlur = () => setIsTyping(false);

  return (
    <div
      className="asset-modal-backdrop auth-modal-backdrop"
      onPointerDown={onClose}
    >
      <div
        className="auth-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="关闭"
        >
          <X size={18} />
        </button>

        <aside className="auth-modal-left">
          <div className="auth-modal-decor-grid" aria-hidden="true" />
          <div className="auth-modal-decor-blur auth-modal-decor-blur-1" aria-hidden="true" />
          <div className="auth-modal-decor-blur auth-modal-decor-blur-2" aria-hidden="true" />

          <div className="auth-modal-brand">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="auth-modal-brand-logo" />
            ) : (
              <span className="auth-modal-brand-mark">
                <Sparkles size={18} />
              </span>
            )}
            <span className="auth-modal-brand-name">{siteTitle}</span>
          </div>

          <div className="auth-modal-characters">
            <AnimatedCharacters
              isTyping={isTyping}
              showPassword={showPassword}
              passwordLength={passwordLength}
            />
          </div>

          <p className="auth-modal-left-tagline">{siteSlogan}</p>
        </aside>

        <div className="auth-modal-right">
          <div className="auth-modal-form-wrap">
            <div className="auth-modal-mobile-brand">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="auth-modal-mobile-logo" />
              ) : (
                <span className="auth-modal-brand-mark auth-modal-brand-mark-sm">
                  <Sparkles size={16} />
                </span>
              )}
              <span>{siteTitle}</span>
            </div>

            <header className="auth-modal-form-header">
              <h2 id="auth-modal-title">{formTitle}</h2>
              <p>{formSubtitle}</p>
            </header>

            {error ? <div className="auth-modal-error">{error}</div> : null}

            {mode === 'login' ? (
              <form className="auth-modal-form" onSubmit={handleLogin}>
                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-login-username">
                    账号
                  </label>
                  <label className="auth-field">
                    <User size={16} aria-hidden="true" />
                    <input
                      id="auth-login-username"
                      type="text"
                      placeholder="输入您的账号"
                      value={loginForm.username}
                      onChange={(event) =>
                        setLoginForm((prev) => ({ ...prev, username: event.target.value }))
                      }
                      onFocus={handleTypingFocus}
                      onBlur={handleTypingBlur}
                      autoComplete="username"
                    />
                  </label>
                </div>

                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-login-password">
                    密码
                  </label>
                  <label className="auth-field">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      id="auth-login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="输入您的密码"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="auth-eye-toggle"
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </label>
                </div>

                <button type="submit" className="auth-submit" disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="spin" /> : null}
                  {submitting ? '登录中...' : '登录'}
                </button>

                <p className="auth-switch-hint">
                  还没有账号？
                  <button type="button" onClick={() => switchMode('register')}>
                    立即注册
                  </button>
                </p>
              </form>
            ) : (
              <form className="auth-modal-form auth-modal-form-register" onSubmit={handleRegister}>
                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-register-nickname">
                    用户名
                  </label>
                  <label className="auth-field">
                    <User size={16} aria-hidden="true" />
                    <input
                      id="auth-register-nickname"
                      type="text"
                      placeholder="输入用户名"
                      value={registerForm.nickname}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({ ...prev, nickname: event.target.value }))
                      }
                      onFocus={handleTypingFocus}
                      onBlur={handleTypingBlur}
                      autoComplete="username"
                    />
                  </label>
                </div>

                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-register-email">
                    邮箱
                  </label>
                  <label className="auth-field auth-field-with-action">
                    <Mail size={16} aria-hidden="true" />
                    <input
                      id="auth-register-email"
                      type="email"
                      placeholder="输入邮箱"
                      value={registerForm.email}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      onFocus={handleTypingFocus}
                      onBlur={handleTypingBlur}
                      autoComplete="email"
                    />
                    <button
                      type="button"
                      className="auth-code-btn"
                      disabled={codeCooldown > 0 || submitting}
                      onClick={handleSendCode}
                    >
                      {codeCooldown > 0 ? `${codeCooldown}s` : '发送验证码'}
                    </button>
                  </label>
                </div>

                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-register-code">
                    验证码
                  </label>
                  <label className="auth-field">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      id="auth-register-code"
                      type="text"
                      placeholder="邮箱验证码"
                      value={registerForm.verifyCode}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({ ...prev, verifyCode: event.target.value }))
                      }
                      autoComplete="one-time-code"
                    />
                  </label>
                </div>

                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-register-password">
                    密码
                  </label>
                  <label className="auth-field">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      id="auth-register-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="设置密码"
                      value={registerForm.password}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="auth-eye-toggle"
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </label>
                </div>

                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-register-confirm">
                    确认密码
                  </label>
                  <label className="auth-field">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      id="auth-register-confirm"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="再次输入密码"
                      value={registerForm.confirmPassword}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          confirmPassword: event.target.value,
                        }))
                      }
                      autoComplete="new-password"
                    />
                  </label>
                </div>

                {roles.length > 0 ? (
                  <div className="auth-field-group">
                    <label className="auth-field-label" htmlFor="auth-register-role">
                      角色
                    </label>
                    <label className="auth-field auth-field-select">
                      <select
                        id="auth-register-role"
                        value={registerForm.roleId}
                        disabled={rolesLoading}
                        onChange={(event) =>
                          setRegisterForm((prev) => ({ ...prev, roleId: event.target.value }))
                        }
                      >
                        {roles.map((role) => {
                          const id = role.id ?? role.ID;
                          const name = role.name ?? role.Name ?? `角色 ${id}`;
                          return (
                            <option key={id} value={String(id)}>
                              {name}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </div>
                ) : null}

                <button type="submit" className="auth-submit" disabled={submitting || rolesLoading}>
                  {submitting ? <Loader2 size={16} className="spin" /> : null}
                  {submitting ? '注册中...' : '注册'}
                </button>

                <p className="auth-switch-hint">
                  已有账号？
                  <button type="button" onClick={() => switchMode('login')}>
                    去登录
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
