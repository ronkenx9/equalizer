# EQUALIZER — Evaluation System Roadmap

## Phase 1: Criteria Extraction (Build Now)
- At deal creation, extract structured evaluation criteria from plain English terms
- Show extracted criteria to both parties before confirmation ("I'll evaluate against:")
- Store criteria with deal state
- At delivery, evaluate each criterion individually → per-criterion PASS/FAIL
- Transparent results: both parties see exactly what passed and what failed
- Confidence thresholds: >85% all pass → DELIVERED, >85% some fail → resubmit/dispute, <70% → fallback to silence window

### Deliverable Classification
Types identified at deal creation (not delivery):
- `social_post` — Twitter, Instagram, TikTok
- `video_content` — YouTube, TikTok, Twitch
- `written_content` — article, report, doc
- `code` — GitHub repo, deployed contract
- `design` — Figma, image, asset
- `stream` — live or VOD
- `other` — flagged for human review

### What's Verifiable vs Not
**Verifiable (agent evaluates):**
- URL resolves / link is live
- Posted before deadline (timestamp check)
- Contains required keywords (text scan)
- Brand name mentioned (exact match)
- Required CTA included (exact match)
- Content is public (accessibility)
- Word count / length requirement (countable)
- Required hashtags present (exact match)
- Tagged required accounts (exact match)
- Code compiles and tests pass (runnable)
- Report contains required sections (structural)

**Not verifiable (agent does NOT judge):**
- Quality / "is this good?"
- Performance / engagement
- Tone / voice
- Brand representation
- Creativity

## Phase 2: Domain-Specialist Model Routing (Post-Hackathon)
Route deliverables to the model best equipped to evaluate them:
- Code → Claude / DeepSeek Coder / Codestral
- Design → GPT-4V / Claude Vision / Gemini Pro Vision
- Research → Perplexity API (search-grounded)
- Social media → Groq Llama (fast, cheap)
- Legal → Claude (strong legal reasoning)
- Video → YouTube Data API + transcription pipeline

### Architecture
```
Delivery submitted
      ↓
ORCHESTRATOR (Groq — cheap + fast)
→ Classifies deliverable type
→ Selects specialist model
      ↓
SPECIALIST EVALUATOR
→ Runs domain-specific checks
→ Returns structured result
      ↓
EQUALIZER
→ Records result
→ Triggers release or dispute window
```

## Phase 3: Private Evaluation via Venice (Post-Hackathon)
Run evaluations inside Venice's private inference layer:
- **Public (onchain):** locked criteria, submission timestamp, overall verdict, per-criterion results, one-line reasoning
- **Private (Venice):** which model evaluated, full reasoning chain, confidence scores, prompts, model weights
- **Semi-private (EQUALIZER only):** evaluation logs for appeals, pattern data, model analytics

Gaming mitigation: creators can't reverse-engineer the evaluator because they can't see which model was used, what prompt was sent, or how criteria are weighted. The only way to "game" the system is to deliver exactly what was agreed.

## Phase 4: Multi-Model Consensus (Post-Hackathon)
For high-value deals, run multiple models and require consensus:
```
$5,000 brand campaign delivery:
→ Groq: PASS (82%)
→ Claude: PASS (91%)
→ GPT-4V: PARTIAL (71%)

Consensus: PASS with note
```

Neither party can argue bias when three independent models agree.

### Tiered Pricing
- **Basic:** Groq generalist evaluation (included in 2.5% fee)
- **Professional:** Specialist model evaluation (+0.5%)
- **Enterprise:** Multi-model consensus (+1%)

## Phase 5: Platform Scraping Pipeline (Post-Hackathon)
Real-time verification per platform:
- Twitter/X API → scrape thread content, check hashtags/mentions
- YouTube Data API → video metadata, duration, title keywords
- GitHub API → repo exists, tests pass, commit history
- Figma API → file exists, dimensions check
- Google Docs API → section structure verification

## Key Design Principle
> "Evaluation runs inside Venice's private inference. The criteria are public. The evaluator is not. You can verify the outcome. You cannot reverse-engineer the process."

---
*Outcomes are radically transparent. Processes are radically private.*
