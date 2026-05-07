import Link, { type LinkProps } from 'next/link';
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './Button';

type AnchorWithoutHref = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

export interface ButtonLinkProps extends AnchorWithoutHref, Pick<LinkProps, 'href' | 'prefetch' | 'replace' | 'scroll'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  external?: boolean;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  function ButtonLink(
    {
      variant = 'primary',
      size = 'md',
      fullWidth,
      external,
      iconLeading,
      iconTrailing,
      className,
      children,
      href,
      prefetch,
      replace,
      scroll,
      ...rest
    },
    ref,
  ) {
    const content = (
      <>
        {iconLeading && <span aria-hidden="true">{iconLeading}</span>}
        <span>{children}</span>
        {iconTrailing && <span aria-hidden="true">{iconTrailing}</span>}
      </>
    );

    if (external) {
      return (
        <a
          ref={ref}
          href={typeof href === 'string' ? href : ''}
          rel="noopener noreferrer"
          target="_blank"
          className={buttonClasses(variant, size, fullWidth, className)}
          {...rest}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        ref={ref}
        href={href}
        prefetch={prefetch}
        replace={replace}
        scroll={scroll}
        className={buttonClasses(variant, size, fullWidth, className)}
        {...rest}
      >
        {content}
      </Link>
    );
  },
);
