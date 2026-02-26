import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'lg';
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  onClick,
  loading = false,
  disabled = false,
  className = '',
  children,
}) => {
  const base = 'rounded-full font-medium transition-all duration-200 flex items-center justify-center gap-2';

  const variants = {
    primary: loading
      ? 'bg-accent text-white cursor-wait'
      : 'bg-accent text-white hover:bg-accent-hover disabled:bg-warm-300 disabled:cursor-not-allowed',
    secondary: loading
      ? 'bg-warm-100 text-warm-700 cursor-wait border border-warm-200'
      : 'bg-white text-warm-700 border border-warm-200 hover:bg-warm-100 disabled:opacity-50 disabled:cursor-not-allowed',
  };

  const sizes = {
    md: 'px-5 py-2 text-sm',
    lg: 'px-6 py-2.5 text-sm',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
      )}
      {children}
    </button>
  );
};

export default Button;
