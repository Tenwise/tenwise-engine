# Security

If you find a security problem in the Tenwise Engine, report it privately: use **Report a vulnerability** on this repository's **Security** tab. Please don't open a public issue or pull request for it, or post it anywhere else, until it is fixed.

Include how to reproduce it, what it exposes, and a suggested fix if you have one. We'll confirm we've received it, keep you posted, and credit you when the fix is released, unless you'd rather we didn't.

The engine runs on your own machine for one person, and its API has no authentication by design. A report that depends on someone already running code as you, or on you choosing `HOST=0.0.0.0`, is out of scope; [docs/SECURITY-DESIGN.md](docs/SECURITY-DESIGN.md#out-of-scope) explains why.

## Security design

[docs/SECURITY-DESIGN.md](docs/SECURITY-DESIGN.md) is the threat model: the trust boundaries, and how the code counters each threat, with pointers to the code and its tests.
