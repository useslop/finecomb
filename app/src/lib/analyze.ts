// B1's rule engine has landed — this is the one place that swap happens (see types/engine.ts
// for the matching swap on the types side). Everything else imports `analyze` from here so
// no other file needed to change.
export { analyze } from '@finecomb/engine';
