// ---------------------------------------------------------------------------
// api-gateway / app.controller.ts  —  a minimal HTTP controller.
//
// A "controller" maps incoming HTTP requests to handler methods. Nest builds
// the route table from these decorators at startup.
// ---------------------------------------------------------------------------

import { Controller, Get } from '@nestjs/common';

// @Controller() with no argument = no route prefix. So a @Get('health')
// method below is reachable at exactly  GET /health.
@Controller()
export class AppController {
  // @Get('health') registers this method for  GET /health.
  //
  // WHY a health endpoint exists this early: it's the cheapest possible proof
  // that the process started, the DI graph resolved, and the HTTP layer is
  // serving. Container orchestrators (and our own curl checks) hit this to
  // decide "is this app alive?". Returning a small JSON object (not a bare
  // string) makes it easy to extend later (add version, dependency status…).
  @Get('health')
  health() {
    return { service: 'api-gateway', status: 'ok' };
  }
}
