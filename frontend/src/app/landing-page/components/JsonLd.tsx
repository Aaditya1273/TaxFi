import { generateJsonLdSchema } from '@/lib/seo';

/**
 * JsonLd — server-compatible component that renders JSON-LD structured
 * data script tags for SEO. Place this inside the page content.
 *
 * Usage:
 *   <JsonLd faq webApplication product />
 */
export default function JsonLd({
  website = true,
  organization = true,
  webApplication = true,
  faq = false,
  product = false,
}: {
  website?: boolean;
  organization?: boolean;
  webApplication?: boolean;
  faq?: boolean;
  product?: boolean;
}) {
  const schemaString = generateJsonLdSchema({
    website,
    organization,
    webApplication,
    faq,
    product,
  });

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: schemaString }}
    />
  );
}
