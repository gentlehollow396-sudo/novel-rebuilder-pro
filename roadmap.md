# Roadmap

- [x] Set GEMINI_API_KEY and GROQ_API_KEY secrets
- [x] Update provider model IDs (gemini-3.6-flash, openai/gpt-oss-120b)
- [x] Bug 1: raise default maxTokens to 16000, pass per-segment token budget
- [x] Bug 2: quota-aware provider cooldown (10 min) + errors in success response
- [x] Keep batch runs alive with screen off / app backgrounded (wake lock)
- [ ] Re-run full Great Expectations loop and confirm provider_used
