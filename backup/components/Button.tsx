import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';

  className?: string;
}

export default function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const baseStyle = "px-4 py-2 rounded font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#121212]";
  
  const variants = {
    primary: "bg-minecraft-grass hover:bg-green-700 text-white focus:ring-green-500",
    secondary: "bg-[#1e1e1e] border border-gray-700 text-gray-300 hover:bg-gray-800 focus:ring-gray-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}