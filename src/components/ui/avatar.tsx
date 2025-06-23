import * as React from 'react';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(({
  className = '',
  children,
  ...props
}, ref) => (
  <div
    {...props}
    ref={ref}
    className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-gray-100 ${className}`}
  >
    {children}
  </div>
));
Avatar.displayName = 'Avatar';

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}
const AvatarImage: React.FC<AvatarImageProps> = ({ className = '', ...props }) => (
  <img
    {...props}
    className={`h-full w-full rounded-full object-cover ${className}`}
    alt={props.alt}
  />
);
AvatarImage.displayName = 'AvatarImage';

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}
const AvatarFallback: React.FC<AvatarFallbackProps> = ({ className = '', children, ...props }) => (
  <span
    {...props}
    className={`flex h-full w-full items-center justify-center bg-gray-300 text-gray-600 ${className}`}
  >
    {children}
  </span>
);
AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarImage, AvatarFallback };
