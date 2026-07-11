// CloudFront Functions (viewer-request) — associate with the default cache behavior.
// Use this if your distribution rewrites "pretty URLs" to /index.html for the SPA.
// Without the legal exceptions, /aviso-privacidad is rewritten and view-source shows only <div id="root">.
//
// Deploy: CloudFront console → Functions → Create function → paste → Publish →
//         attach to distribution default behavior (viewer request).
//
// ES5 only. Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-javascript-runtime-features.html

function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Static MPA HTML (S3 keys: benefits, aviso-privacidad, terminos — see deploy-frontend-s3.ps1)
  if (uri === '/benefits' || uri === '/benefits/' ||
      uri === '/aviso-privacidad' || uri === '/aviso-privacidad/' ||
      uri === '/terminos' || uri === '/terminos/') {
    if (uri.length > 1 && uri.charAt(uri.length - 1) === '/') {
      request.uri = uri.substring(0, uri.length - 1);
    }
    return request;
  }

  if (uri.indexOf('/assets/') === 0) {
    return request;
  }
  if (uri.indexOf('.') !== -1) {
    return request;
  }

  request.uri = '/index.html';
  return request;
}
