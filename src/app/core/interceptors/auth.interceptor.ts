import { HttpInterceptorFn } from '@angular/common/http';

// Authentication is handled via an HTTP-only JWT cookie that the browser
// automatically attaches to every same-origin request, so no manual
// Authorization header is required. This interceptor is kept as a passthrough
// hook for future auth-related request processing.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Ensure the JWT cookie is sent with every same-origin request.
  const cloned = req.withCredentials ? req : req.clone({ withCredentials: true });
  return next(cloned);
};
