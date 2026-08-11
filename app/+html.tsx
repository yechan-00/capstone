import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko" translate="no" className="notranslate">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta httpEquiv="Content-Language" content="ko" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="google" content="notranslate" />
        <meta name="googlebot" content="notranslate" />
        <title>후회가계부</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root, .notranslate, [translate="no"] {
                translate: no !important;
              }
            `,
          }}
        />
      </head>
      <body className="notranslate" translate="no">
        {children}
      </body>
    </html>
  );
}
