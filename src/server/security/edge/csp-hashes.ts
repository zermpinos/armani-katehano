export const scriptHashes: readonly string[] = [];

// Two sources land here:
//   1. The build-time inline style on 500.html (captured by regenerate-csp-hashes).
//   2. Runtime-injected styles from React / Recharts / Tailwind preflight,
//      collected from real CSP violation reports on Vercel Preview. These
//      will not appear in the build output and must be appended by hand.
export const styleHashes: readonly string[] = [
  "sha256-19U6/ccNF8aPwxmQzpRtgfKkvWkb+WjEmvRtplbo75Q=",
  "sha256-4t2hwuCFf/ncOE77y1HXa46OEl+jzS9dH0Gz88/YzbM=",
  "sha256-Vw9WV3SMnQjKSHaaXTz6/TmRsmC9/FgweoFY3xRXghY=",
  "sha256-Z5XTK23DFuEMs0PwnyZDO9SWxemQ5HxcpVaBNuUJyWY=",
  "sha256-fxkN4c/2nO1SmeNIKDXcFVD1poH21fkzl8F/PSmJ8GE=",
  "sha256-p2PSMpDa/5boo5l1b0wQgMtThA/LasMB1Ezif8auRsA=",
  "sha256-y/7CwTPJQbRWG8gKg35rzYn/jkpp5kIr6Q+32kEMKTA=",
];
