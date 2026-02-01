---
name: notify-ralph
description: Send your review result to Ralph
for: lisa
---

# Notify Ralph

Send your review result to Ralph.

## Usage

Call this skill after completing your review of Ralph's submission.

## Content Format

**For PASS**:
```markdown
### Review Result

#### Checklist
- [x] Functionality complete
- [x] Logic correct
- [x] Edge cases handled
- [x] Code quality acceptable
- [x] Tests adequate

#### Verdict
**PASS** ✓

#### Comments
[Optional comments]

#### Consensus Check
I believe this step is complete. Do you agree to proceed?
```

**For NEEDS_WORK**:
```markdown
### Review Result

#### Checklist
- [x] Functionality complete
- [ ] Logic correct ← Issue

#### Verdict
**NEEDS_WORK**

#### Issues Found
1. **Issue Name**: [Description]
   - Location: [file:line]
   - Problem: [What's wrong]
   - Suggestion: [How to fix]

#### Summary
Please address N issues and resubmit.
```

## Execution

```bash
./mini-skill/io.sh lisa "$CONTENT"
```

## After Submission

- Ralph will receive your review
- Ralph will evaluate your opinion (it's advisory, not a command)
- If Ralph agrees: consensus reached, proceed to next round
- If Ralph disagrees: continue discussion until consensus
