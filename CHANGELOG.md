# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6] - 2026-09-28

### Added

- `requestTimeoutMs` SDK option (default 15000) for Partner Backend requests;
  timeouts reject with `request_timeout`. Non-positive, non-finite or
  out-of-range values throw `invalid_argument` from the constructor.
- `signal` option on `authenticate()` to cancel Partner Backend requests;
  cancellation rejects with `aborted`.
- `SuperappEmbedError.status` carries the HTTP status for Partner Backend
  failures.
- Type declarations for the public `bridge`, `fetch`, `timeoutMs` and
  `requestTimeoutMs` instance properties.

### Changed

- Concurrent `authenticate()` calls with the same `bootstrapURL`,
  `completeURL`, `scopes` and `signal` now share one in-flight flow, so a
  repeated tap creates a single bootstrap transaction and native consent
  prompt. The next call after the flow settles (success or failure) starts
  a new one.
- Host bridge rejections given as a plain string, or as `{ errCode, errMsg }`,
  now keep their original code and message instead of the generic
  `bridge_error` text. Numeric codes are converted to strings.
- Partner Backend error responses only pass through `code` and `message`
  when they are non-empty strings (or numeric codes); otherwise the SDK
  falls back to `partner_request_failed` and a generic message.

### Fixed

- `getAuthCode()` now rejects with `invalid_bridge_response` when the host
  response has no `code`. Previously `authenticate()` sent the completion
  request without it.
- A 2xx Partner Backend response whose body is not a JSON object (for
  example an HTML gateway or login page) now rejects with
  `invalid_response`. Previously it was treated as `{}`, which surfaced as a
  misleading `invalid_argument: transactionId is required`. An empty body
  such as 204 is still treated as `{}`.
- A bootstrap response missing `transaction_id`, `client_id`, `state` or
  `code_challenge`, or with non-string-array `scopes`, now rejects with
  `invalid_response` before the host bridge is called.
- A non-2xx response with a `null` JSON body no longer throws a native
  `TypeError`.
- `authenticate()` called without options, or without `bootstrapURL` or
  `completeURL`, now rejects with `invalid_argument` before any request is
  sent, instead of throwing a native `TypeError`.

## [0.0.5] - 2026-09-11

### Added

- `saveImageToAlbum()` host bridge passthrough.

## [0.0.4] - 2026-09-09

### Added

- `dialPhone()` host bridge passthrough.

## [0.0.3] - 2026-09-04

### Added

- `scanCode()` host bridge passthrough.

## [0.0.2] - 2026-09-01

### Fixed

- Structured error codes from host bridge rejections (for example
  `user_denied`) are passed through to `SuperappEmbedError.code` instead of
  always being wrapped as `bridge_error`.

## [0.0.1] - 2026-07-31

### Added

- Initial Superapp Embed JS SDK: `getContext`, `getAuthCode`,
  `authenticate`, `openPrivacySettings` and `close`.

> Note: the `v0.0.3`, `v0.0.4` and `v0.0.5` git tags were created before the
> `package.json` version was bumped, so their manifests report `0.0.2`,
> `0.0.2` and `0.0.4` respectively.

[Unreleased]: https://github.com/jiguangliandong/superapp-embed-js-sdk/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/jiguangliandong/superapp-embed-js-sdk/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/jiguangliandong/superapp-embed-js-sdk/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/jiguangliandong/superapp-embed-js-sdk/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/jiguangliandong/superapp-embed-js-sdk/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/jiguangliandong/superapp-embed-js-sdk/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/jiguangliandong/superapp-embed-js-sdk/releases/tag/v0.0.1
