# T11 Dispatch: GP5/GP Import  
 
Owner: Pi | Depends: T7 done | Status: started 
 
## Objective 
Verify GP5/GP file import parser and score display pipeline. 
 
## Allowed Files 
- frontend/src/parser/ (new) 
- frontend/src/store/ (new) 
- tests/score-fixtures/ (new) 
- contracts/ 
 
## Requirements 
1. Parse GP5/GP binary (not GPX) 
2. Extract: tracks, tuning, tempo, measures, notes, techniques, dynamics 
3. Internal Score Representation (ISR) for bridge transport 
4. Tests with real .gp5 files 
5. Write contracts/score-format.md 
 
## Verification 
- npm run typecheck passes 
- npm test all pass 
- npm run build passes 
- Evidence: docs/validation/t11-gp5.md 
 
## Ref 
- docs/project-arrangement-review.md 
- .agents/pi.md 
