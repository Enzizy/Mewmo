import { handleRequest } from '../server/index.mjs';

export default function handler(request, response) {
  request.url = request.url?.replace(/^\/api(?=\/|\?|$)/, '') || '/';
  return handleRequest(request, response);
}
