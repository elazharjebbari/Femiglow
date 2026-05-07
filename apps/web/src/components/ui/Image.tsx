import NextImage, { type ImageProps as NextImageProps } from 'next/image';
import { cn } from '@/lib/utils/cn';

type Ratio = '16:9' | '4:5' | '1:1' | '3:4' | '21:9' | '5:7' | '4:3' | '3:2';
type ObjectPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';

export interface ImageProps extends Omit<NextImageProps, 'placeholder' | 'fill'> {
  ratio: Ratio;
  rounded?: boolean;
  blurDataURL?: string;
  objectPosition?: ObjectPosition;
  className?: string;
}

const ratioMap: Record<Ratio, string> = {
  '16:9': 'aspect-[16/9]',
  '4:5': 'aspect-[4/5]',
  '4:3': 'aspect-[4/3]',
  '3:2': 'aspect-[3/2]',
  '1:1': 'aspect-square',
  '3:4': 'aspect-[3/4]',
  '21:9': 'aspect-[21/9]',
  '5:7': 'aspect-[5/7]',
};

const objectPositionMap: Record<ObjectPosition, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
  left: 'object-left',
  right: 'object-right',
};

export function Image({
  ratio,
  rounded = false,
  blurDataURL,
  objectPosition = 'center',
  className,
  alt,
  sizes,
  priority,
  width: _width,
  height: _height,
  ...rest
}: ImageProps) {
  void _width;
  void _height;
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-encre/5',
        ratioMap[ratio],
        rounded && 'rounded-md',
        className,
      )}
    >
      <NextImage
        {...rest}
        alt={alt}
        fill
        sizes={sizes ?? '(min-width: 1280px) 1200px, (min-width: 720px) 90vw, 100vw'}
        placeholder={blurDataURL ? 'blur' : 'empty'}
        blurDataURL={blurDataURL}
        priority={priority}
        className={cn('object-cover', objectPositionMap[objectPosition])}
      />
    </div>
  );
}
