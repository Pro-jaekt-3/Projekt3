# DIAGRAMS — Projekt3

AI-assisted question and assessment management system.
All diagrams are written in Mermaid syntax.

---

## 1. Entity-Relationship Diagram

Source: `backend/prisma/schema.prisma`. Legacy FAZA-0 tables (`LearningObjective`, `EquivalentQuestionGroup`) and their relations are included and labelled accordingly.

```mermaid
erDiagram
    User {
        int id PK
        string firebaseUid UK
        string email UK
        string name
        UserRole role
        datetime createdAt
        datetime updatedAt
    }
    Training {
        int id PK
        string title
        string description
        string enrollmentToken UK
        datetime createdAt
        datetime updatedAt
    }
    UserTraining {
        int id PK
        int userId FK
        int trainingId FK
        TrainingRole role
        datetime enrolledAt
    }
    Topic {
        int id PK
        string name
        int trainingId FK
        datetime createdAt
        datetime updatedAt
    }
    LearningObjective {
        int id PK
        string title
        string description
        int topicId FK
    }
    EquivalenceGroup {
        int id PK
        int trainingId FK
        string title
        string description
        datetime createdAt
        datetime updatedAt
    }
    EquivalentQuestionGroup {
        int id PK
        string name
        string description
        datetime createdAt
        datetime updatedAt
    }
    Question {
        int id PK
        string title
        text description
        int difficulty
        QuestionType type
        QuestionStatus status
        int topicId FK
        int learningObjectiveId FK
        int createdById FK
        int reviewedById FK
        datetime reviewedAt
        int equivalentGroupId FK
        int equivalenceGroupId FK
        datetime createdAt
        datetime updatedAt
    }
    AnswerOption {
        int id PK
        int questionId FK
        string text
        boolean isCorrect
        int orderIndex
    }
    Assessment {
        int id PK
        string title
        string description
        int trainingId FK
        AssessmentType type
        AssessmentStatus status
        int timeLimitMinutes
        int pairedAssessmentId FK
        datetime createdAt
        datetime updatedAt
    }
    AssessmentBlueprint {
        int id PK
        string title
        int trainingId FK
        int targetQuestionCount
        json configJson
        datetime createdAt
        datetime updatedAt
    }
    AssessmentQuestion {
        int id PK
        int assessmentId FK
        int questionId FK
        int orderIndex
        float points
    }
    AssessmentAttempt {
        int id PK
        int assessmentId FK
        int userId FK
        datetime startedAt
        datetime submittedAt
        float score
        float maxScore
        AttemptStatus status
        datetime createdAt
        datetime updatedAt
    }
    ParticipantAnswer {
        int id PK
        int attemptId FK
        int questionId FK
        int selectedOptionId FK
        text answerText
        boolean isCorrect
        float pointsAwarded
        boolean needsManualReview
        int gradedById FK
        datetime gradedAt
        datetime createdAt
        datetime updatedAt
    }
    AiModel {
        int id PK
        AiProvider provider
        string modelName
        string displayName
        string baseUrl
        boolean isLocal
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    AiInteraction {
        int id PK
        int aiModelId FK
        int requestedById FK
        AiAction action
        longtext prompt
        longtext resultText
        json resultJson
        int sourceQuestionId FK
        int generatedQuestionId FK
        AiReviewStatus reviewStatus
        int reviewedById FK
        datetime reviewedAt
        datetime createdAt
        datetime updatedAt
    }

    User           ||--o{ UserTraining        : "belongs to"
    Training       ||--o{ UserTraining        : "has members"
    Training       ||--o{ Topic               : "contains"
    Training       ||--o{ Assessment          : "has"
    Training       ||--o{ AssessmentBlueprint : "has"
    Training       ||--o{ EquivalenceGroup    : "scopes"
    Topic          ||--o{ LearningObjective   : "has (legacy)"
    Topic          ||--o{ Question            : "groups"
    LearningObjective |o--o{ Question         : "covers (legacy)"
    User           ||--o{ Question            : "creates"
    User           |o--o{ Question            : "reviews"
    EquivalentQuestionGroup |o--o{ Question   : "groups (legacy)"
    EquivalenceGroup |o--o{ Question          : "groups"
    Question       ||--o{ AnswerOption        : "has options"
    Question       ||--o{ AssessmentQuestion  : "included in"
    Question       ||--o{ ParticipantAnswer   : "answered by"
    Question       |o--o{ AiInteraction       : "is source for"
    Question       |o--o{ AiInteraction       : "is generated in"
    Assessment     ||--o{ AssessmentQuestion  : "contains"
    Assessment     ||--o{ AssessmentAttempt   : "attempted via"
    Assessment     |o--o| Assessment          : "paired with"
    AssessmentAttempt ||--o{ ParticipantAnswer : "has"
    User           |o--o{ AssessmentAttempt   : "takes"
    AnswerOption   |o--o{ ParticipantAnswer   : "selected in"
    User           |o--o{ ParticipantAnswer   : "grades"
    AiModel        ||--o{ AiInteraction       : "used in"
    User           ||--o{ AiInteraction       : "requests"
    User           |o--o{ AiInteraction       : "reviews"
```

---

## 2. Use Case Diagram

All three roles and their permitted actions across the system. Rendered as a flowchart (Mermaid has no native UML Use Case syntax).

```mermaid
flowchart LR
    ADMIN((ADMIN))
    INSTRUCTOR((INSTRUCTOR))
    PARTICIPANT((PARTICIPANT))

    subgraph SYS["System Boundary — Projekt3"]

        subgraph USR["User & System Management"]
            UC_Users["Manage Users\n(list, assign role)"]
            UC_AiModels["Manage AI Models\n(create, test, delete)"]
            UC_OllamaStatus["Check Ollama Status"]
        end

        subgraph TRN["Training Management"]
            UC_AllTrainings["View All Trainings"]
            UC_MyTrainings["View My Trainings"]
            UC_CreateTraining["Create / Edit / Delete Training"]
            UC_Members["Manage Training Members"]
            UC_Token["Generate Enrollment Token"]
            UC_Join["Enroll via QR / Token"]
        end

        subgraph CNT["Content Authoring"]
            UC_Topics["Manage Topics"]
            UC_Questions["Create / Edit / Delete Questions"]
            UC_Status["Set Question Status\n(review, approve, reject, archive)"]
            UC_EquivGroups["Manage Equivalence Groups"]
        end

        subgraph AI["AI Assistant"]
            UC_GenDraft["Generate Question Draft"]
            UC_GenEquiv["Generate Equivalent Question"]
            UC_SuggestEquiv["Suggest Question Equivalence"]
            UC_ReviewAI["Review AI Interactions\n(accept / reject)"]
            UC_Insights["View Pre/Post AI Insights"]
        end

        subgraph ASS["Assessment Management"]
            UC_GenAssess["Generate Assessment\n(pre/post/quiz)"]
            UC_ManageAssess["Publish / Archive Assessment"]
            UC_Results["View Assessment Results"]
            UC_Grade["Grade Open / Code Answers"]
            UC_Analytics["View Analytics\n(by topic, difficulty, trends)"]
            UC_Participants["View Participant Profiles"]
            UC_Leaderboard["View Leaderboard"]
        end

        subgraph PAR["Participant Flow"]
            UC_Available["View Available Assessments"]
            UC_Solve["Start & Solve Assessment"]
            UC_Submit["Submit Assessment"]
            UC_MyResults["View My Results"]
        end

    end

    ADMIN --> UC_Users
    ADMIN --> UC_AiModels
    ADMIN --> UC_OllamaStatus
    ADMIN --> UC_AllTrainings
    ADMIN --> UC_CreateTraining
    ADMIN --> UC_Members
    ADMIN --> UC_Token
    ADMIN --> UC_GenDraft
    ADMIN --> UC_GenEquiv
    ADMIN --> UC_SuggestEquiv
    ADMIN --> UC_ReviewAI

    INSTRUCTOR --> UC_MyTrainings
    INSTRUCTOR --> UC_CreateTraining
    INSTRUCTOR --> UC_Members
    INSTRUCTOR --> UC_Token
    INSTRUCTOR --> UC_Topics
    INSTRUCTOR --> UC_Questions
    INSTRUCTOR --> UC_Status
    INSTRUCTOR --> UC_EquivGroups
    INSTRUCTOR --> UC_GenDraft
    INSTRUCTOR --> UC_GenEquiv
    INSTRUCTOR --> UC_SuggestEquiv
    INSTRUCTOR --> UC_ReviewAI
    INSTRUCTOR --> UC_Insights
    INSTRUCTOR --> UC_OllamaStatus
    INSTRUCTOR --> UC_GenAssess
    INSTRUCTOR --> UC_ManageAssess
    INSTRUCTOR --> UC_Results
    INSTRUCTOR --> UC_Grade
    INSTRUCTOR --> UC_Analytics
    INSTRUCTOR --> UC_Participants
    INSTRUCTOR --> UC_Leaderboard

    PARTICIPANT --> UC_MyTrainings
    PARTICIPANT --> UC_Join
    PARTICIPANT --> UC_Available
    PARTICIPANT --> UC_Solve
    PARTICIPANT --> UC_Submit
    PARTICIPANT --> UC_MyResults
    PARTICIPANT --> UC_Leaderboard
```

---

## 3. Sequence Diagram — Assessment Solving Flow

End-to-end flow from a Participant opening an assessment to receiving a result.

```mermaid
sequenceDiagram
    actor P as Participant
    participant FE as Frontend (React)
    participant LS as localStorage
    participant BE as Backend (Express :3000)
    participant FA as Firebase Auth
    participant DB as MySQL (via Prisma)

    P->>FE: Navigate to /assessment/:id/access
    FE->>BE: GET /assessments/available
    BE->>FA: verifyIdToken(Bearer)
    FA-->>BE: uid, role
    BE->>DB: SELECT assessments WHERE published\nAND participant enrolled (UserTraining)
    DB-->>BE: Assessment list
    BE-->>FE: Available assessments
    FE-->>P: Show assessment info + Start button

    P->>FE: Click "Start Attempt"
    FE->>BE: POST /assessment-attempts/start\n{assessmentId}
    BE->>FA: verifyIdToken(Bearer)
    FA-->>BE: uid, role
    BE->>DB: SELECT UserTraining\nWHERE userId + trainingId (requireEnrollment)
    DB-->>BE: Enrollment confirmed
    BE->>DB: SELECT AssessmentAttempt WHERE\nassessmentId + userId (duplicate check)
    DB-->>BE: No existing attempt
    BE->>DB: INSERT AssessmentAttempt\n{status: IN_PROGRESS, startedAt: now()}
    DB-->>BE: attempt {id}
    BE-->>FE: 201 {id, status: IN_PROGRESS}
    FE->>LS: rememberAttemptId(assessmentId, attemptId)

    FE->>BE: GET /assessment-attempts/:id
    BE->>DB: SELECT AssessmentAttempt\nINCLUDE assessment.questions.question.answerOptions\nINCLUDE answers
    DB-->>BE: Attempt with nested data
    BE-->>FE: Attempt (answerOptions.isCorrect stripped\nat service seam)
    FE-->>P: Render question solver (MCQ checkboxes,\nopen/code textarea)

    loop For each question
        P->>FE: Select option(s) / type text
        FE->>FE: Update local answers state
    end

    P->>FE: Click "Submit"
    FE->>BE: POST /assessment-attempts/:id/submit\n{answers: [{questionId, selectedOptionId?},\n{questionId, textAnswer?}, ...]}
    BE->>DB: SELECT AssessmentAttempt + questions\nwith answerOptions (validation)
    DB-->>BE: Attempt data
    BE->>BE: Validate each answer belongs\nto this assessment
    BE->>BE: Grade MCQ: check selectedOption.isCorrect\ncalculate pointsAwarded per question
    BE->>DB: DELETE existing ParticipantAnswers
    BE->>DB: INSERT ParticipantAnswers (createMany)
    DB-->>BE: ok

    BE->>DB: COUNT ParticipantAnswers\nWHERE needsManualReview = true
    DB-->>BE: pendingCount

    alt pendingCount = 0 (MCQ-only attempt)
        BE->>DB: UPDATE AssessmentAttempt\nSET status=GRADED, score=sum, maxScore
    else pendingCount > 0 (has OPEN or CODE answers)
        BE->>DB: UPDATE AssessmentAttempt\nSET status=SUBMITTED, score, maxScore
    end

    DB-->>BE: Updated attempt
    BE-->>FE: {status: GRADED|SUBMITTED, score, maxScore}
    FE->>FE: Navigate to /assessment/:id/result
    FE-->>P: Show score and answer breakdown
```

---

## 4. Activity Diagram — Question Lifecycle

Lifecycle of a question from creation to retirement, driven by `QuestionStatus` transitions.

```mermaid
stateDiagram-v2
    direction LR

    [*] --> DRAFT : Instructor creates question

    DRAFT --> NEEDS_REVIEW : Instructor submits for review
    DRAFT --> ARCHIVED : Instructor discards

    NEEDS_REVIEW --> REVIEW : Reviewer picks up question
    NEEDS_REVIEW --> DRAFT : Reviewer sends back\n(needs changes)

    REVIEW --> APPROVED : Reviewer approves
    REVIEW --> REJECTED : Reviewer rejects

    REJECTED --> DRAFT : Instructor re-edits\nand resubmits
    REJECTED --> ARCHIVED : Instructor discards

    APPROVED --> ARCHIVED : Instructor retires question

    note right of APPROVED
        Only APPROVED questions
        are eligible for inclusion
        in generated assessments.
    end note

    note right of DRAFT
        AI-generated drafts always
        start here (never skip review).
    end note

    ARCHIVED --> [*]
    APPROVED --> [*] : In active use
```

---

## 5. Deployment Diagram

Runtime topology: where each component runs and how they communicate.

```mermaid
graph TD
    subgraph Browser["Client — Browser"]
        FE["React 19 + Vite\nTailwind CSS · TanStack Router\nFirebase Web SDK\n──────────────\ndev: http://localhost:5173\nprod: static build / CDN"]
    end

    subgraph AppServer["Application Server — Node.js"]
        BE["Express 5 REST API\n──────────────\nMiddleware: firebaseAuthMiddleware\n           requireRole\n           requireOwnership / requireEnrollment\nORM: Prisma (CommonJS)\nPort: 3000"]
    end

    subgraph DataLayer["Data Layer"]
        DB[("MySQL 8\nPort: 3306\nAccessed via Prisma")]
    end

    subgraph ExternalCloud["External — Google Cloud"]
        FA["Firebase Authentication\nverifyIdToken (Admin SDK)\ngetIdToken (Web SDK)"]
    end

    subgraph LocalAI["Local AI Runtime"]
        OL["Ollama\nDefault model: qwen3:8b\nPort: 11434\nHTTP /api/generate"]
    end

    FE -->|"HTTP REST\nAuthorization: Bearer JWT"| BE
    FE -->|"signInWithEmailAndPassword\ngetIdToken()"| FA
    BE -->|"verifyIdToken()\nFirebase Admin SDK"| FA
    BE -->|"Prisma Client\nTCP :3306"| DB
    BE -->|"HTTP POST /api/generate\nlocal network only"| OL
```
