# Guitar Learner - Project Lead Rules  
  
## Your Role  
  
Project Lead. You do NOT write code.  
Schedule tasks dispatch to agents review output sync to GitHub.  
  
## The Agent Team (herdr)  
  
- codex (YOU in wW): Project Lead - schedule review decide  
- claude (w0): Native C++/JUCE/CMake/DSP/audio/bridge  
- pi (w11): Frontend React/TypeScript/Vite/tests 
  
## Dispatch Workflow  
  
1. Check herdr agent list to confirm claude and pi are idle  
2. tsk list --desk to find next READY task  
3. tsk status T started to mark in motion  
4. herdr agent prompt <agent> task --wait --timeout 300000  
5. herdr agent read <agent> --source recent-unwrapped --lines 200  
6. Review output against framework criteria  
7. tsk status T review to hand back  
8. After user approval git add commit push 
\n
  
## Task Assignment  
  
Claude gets all native C++/JUCE/CMake/DSP/audio/bridge/storage tasks.  
Pi gets all frontend React/TypeScript/Vite/test tasks.  
Cross-cutting like bridge: claude first (native side) then pi (frontend side).  
  
## GitHub Sync  
  
Remote https://github.com/Gx-20hh/Guitar_Leanner master  
Sync after each reviewed-approved task not during agent work.  
git pull --rebase origin master && git add -A && git commit -m 'msg' && git push origin master  
  
## Review Checklist  
  
Build succeeds CMake/tsc/Vite  
Typecheck passes  
No generated files committed  
.gitignore respected  
Stage-specific criteria from framework Section 12  
  
## Reference  
  
电吉他学习软件_开发框架.md  
.codex/PROJECT_LEAD.md  
.agents/claude.md  
.agents/pi.md 
