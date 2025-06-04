
import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const IconButton: React.FC<IconButtonProps> = ({ icon, label, variant = 'primary', size = 'md', className, ...props }) => {
  const baseClasses = "flex items-center justify-center rounded-full p-2 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800";
  
  const variantClasses = {
    primary: "bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-500",
    secondary: "bg-slate-600 hover:bg-slate-500 text-slate-100 focus:ring-slate-500",
    danger: "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500",
    ghost: "bg-transparent hover:bg-slate-700 text-slate-300 hover:text-slate-100 focus:ring-sky-500"
  };

  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg"
  };

  return (
    <button
      aria-label={label}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className || ''}`}
      {...props}
    >
      {icon}
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
};

export default IconButton;
