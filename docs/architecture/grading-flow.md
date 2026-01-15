# AI Grading Data Flow

Documents the request-response chain for translation grading.

## Happy Path Sequence

```mermaid
sequenceDiagram
    participant UI as ReviewStep
    participant API as /api/grade
    participant Action as submitReviewForUser
    participant Data as DataAdapter
    participant AI as Gemini API

    UI->>+API: POST { sessionId, itemIndex, userInput, tzOffset }
    API->>API: auth(), consumeAiCall()

    API->>+Action: submitReviewForUser(params)
    Action->>+Data: getSession(sessionId, userId)
    Data-->>-Action: session

    Action->>Action: validate item & index

    opt aiAllowed && attemptHistory needed
        Action->>+Data: getAttemptHistory(userId, sentenceId, 5)
        Data-->>-Action: history[]
    end

    Action->>+AI: gradeTranslation(latin, userInput, ref, history)
    AI-->>-Action: GradingResult

    par Record Attempt
        Action->>Data: recordAttempt(...)
    and Update FSRS
        Action->>Data: recordReview(userId, sentenceId, result)
    end

    Action->>Action: advanceSession(session)
    Action->>+Data: advanceSession(params)
    Data-->>-Action: updated session

    opt session.status === 'complete'
        Action->>Data: getUserProgress()
        Action->>Action: computeStreak()
        Action->>Data: upsertUserProgress()
    end

    Action-->>-API: SubmitReviewResult

    API-->>-UI: { result, userInput, nextIndex, status, rateLimit }
```

## Error Paths

### Rate Limited (aiAllowed=false)

```mermaid
sequenceDiagram
    participant UI as ReviewStep
    participant API as /api/grade
    participant Action as submitReviewForUser

    UI->>+API: POST request
    API->>API: consumeAiCall() returns { allowed: false }
    API->>+Action: submitReviewForUser({ aiAllowed: false })
    Action->>Action: skip AI, create fallback result
    Action-->>-API: SubmitReviewResult (PARTIAL)
    API-->>-UI: Response with rateLimit info
```

### Circuit Breaker Open

```mermaid
sequenceDiagram
    participant Action as submitReviewForUser
    participant Utils as grading-utils
    participant AI as Gemini API

    Action->>+Utils: gradeWithAI(options)
    Utils->>Utils: isCircuitOpen() = true
    Utils-->>-Action: fallback GradingResult
    Note right of Utils: AI never called
```

### Gemini API Failure

```mermaid
sequenceDiagram
    participant Action as submitReviewForUser
    participant Utils as grading-utils
    participant AI as Gemini API

    Action->>+Utils: gradeWithAI(options)
    Utils->>+AI: generateContent()
    AI-->>-Utils: error/timeout

    loop Retry (3 attempts)
        Utils->>+AI: generateContent()
        AI-->>-Utils: error/timeout
    end

    Utils->>Utils: recordFailure()
    Utils-->>-Action: fallback GradingResult
```

## Best-Effort Operations

These operations run but failures don't block the response:

| Operation | Purpose | Failure Impact |
|-----------|---------|----------------|
| `recordAttempt()` | Store attempt history | No history-aware grading later |
| `recordReview()` | Update FSRS state | Card won't be properly scheduled |
| `generateVocabDrills()` | Create vocab cards for struggling | Missing remediation content |
| `upsertUserProgress()` | Update XP/streak | Stats may be stale |

All wrapped in try/catch with console.error logging.

## Session Item Type Routing

```mermaid
flowchart TD
    A[Submit Request] --> B{item.type}
    B -->|REVIEW| C[gradeTranslation]
    B -->|NEW_READING| D[gradeGist]
    B -->|VOCAB_DRILL| E[Error: wrong endpoint]
    B -->|PHRASE_DRILL| F[Error: wrong endpoint]

    C --> G[recordAttempt + recordReview]
    D --> H[recordAttempt + recordReview for each sentence]

    G --> I{shouldGenerateVocabDrills?}
    I -->|Yes| J[generateVocabDrills + save to Convex]
    I -->|No| K[advanceSession]
    J --> K
    H --> K
```

## Vocab/Phrase Drill Endpoints

Separate from main `/api/grade` route:

- `/api/vocab-review` - VocabDrillStep submissions
- `/api/phrase-review` - PhraseDrillStep submissions

Both use `gradeVocab()` / `gradePhrase()` AI functions with simpler schemas.
