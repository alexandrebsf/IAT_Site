import React, { LabelHTMLAttributes } from "react";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const Label: React.FC<LabelProps> = ({ children, className, ...props }) => {
  return (
    <label className={`block text-gray-700 font-medium ${className}`} {...props}>
      {children}
    </label>
  );
};
