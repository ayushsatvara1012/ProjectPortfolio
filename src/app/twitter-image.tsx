import { renderOgImage } from '@/src/seo/ogImage';

export { alt, size, contentType } from '@/src/seo/ogImage';

export default function TwitterImage() {
  return renderOgImage();
}
