import { model, midi, Settings } from "@coderline/alphatab";
import type { InternalScore } from "../parser/isr.js";
import type {
  PlaybackMidiEvent, PlaybackOccurrence, TrainingTarget, PlaybackExpansion,
} from "./playbackTypes.js";

interface RawNote { track:number; start:number; length:number; key:number; velocity:number; channel:number }
interface RawTempo { tick:number; tempo:number }
interface RawTimeSig { tick:number; numerator:number; denominator:number }

function recordHandler() {
  const notes:RawNote[]=[]; const tempos:RawTempo[]=[]; const times:RawTimeSig[]=[];
  const h:midi.IMidiFileHandler = {
    addTimeSignature(t:number,n:number,d:number){times.push({tick:t,numerator:n,denominator:d})},
    addRest(){},
    addNote(t:number,s:number,l:number,k:number,v:number,c:number){notes.push({track:t,start:s,length:l,key:k,velocity:v,channel:c})},
    addControlChange(){}, addProgramChange(){},
    addTempo(t:number,tm:number){tempos.push({tick:t,tempo:tm})},
    addNoteBend(){}, addBend(){}, finishTrack(){}, addTickShift(){},
  };
  return{notes,tempos,times,handler:h};
}

function durAD(d:number):model.Duration {
  switch(d){
    case 1:return model.Duration.Whole;
    case 2:return model.Duration.Half;
    case 4:return model.Duration.Quarter;
    case 8:return model.Duration.Eighth;
    case 16:return model.Duration.Sixteenth;
    case 32:return model.Duration.ThirtySecond;
    default:return model.Duration.Quarter;
  }
}

function tempoAt(tempos:RawTempo[],tick:number,base:number):number {
  const ch=[...tempos].sort((a,b)=>a.tick-b.tick);
  let t=base;
  for(const c of ch){if(c.tick>tick)break;t=c.tempo;}
  return t;
}

function barDur(mbs:model.MasterBar[],bi:number):number {
  if(bi<0||bi>=mbs.length)return 3840;
  return Math.round(960*4*mbs[bi].timeSignatureNumerator/mbs[bi].timeSignatureDenominator);
}

export function expandScore(isr:InternalScore):PlaybackExpansion {
  const scr=new model.Score(); const bt=isr.tempo;
  for(let i=0;i<isr.masterBars.length;i++){
    const mb=isr.masterBars[i]; const mbr=new model.MasterBar();
    mbr.timeSignatureNumerator=mb.timeSignatureNumerator;
    mbr.timeSignatureDenominator=mb.timeSignatureDenominator;
    const automations=mb.tempoAutomations??[]; for(const a of automations){mbr.tempoAutomations.push(model.Automation.buildTempoAutomation(false,a.tick/3840,a.bpm,2,true));} mbr.isRepeatStart=mb.isRepeatStart??false; mbr.repeatCount=mb.repeatCount??0; const tbp=mb.tempoBpm??(i===0?bt:null);
    if(automations.length===0&&tbp!==null)mbr.tempoAutomations.push(model.Automation.buildTempoAutomation(false,0,tbp,2,true));
    scr.addMasterBar(mbr);
  }
  for(const it of isr.tracks){
    const tk=new model.Track(); tk.name=it.name; tk.ensureStaveCount(1);
    tk.staves[0].stringTuning.tunings=[...it.tuning].reverse();
    tk.staves[0].capo=it.capo; scr.addTrack(tk);
    for(const ms of it.measures){
      const br=new model.Bar();
      for(const vb of ms.voices){
        const vc=new model.Voice();
        for(const ib of vb){
          const bt2=new model.Beat(); bt2.duration=durAD(ib.duration); bt2.dots=ib.dots??0;
          for(const iN of ib.notes){
            const nt=new model.Note();
            nt.string=it.stringCount-iN.stringNumber+1;
            nt.fret=iN.fret;
            nt.isTieDestination=iN.isTieDestination;
            bt2.addNote(nt);
          }
          vc.addBeat(bt2);
        }
        br.addVoice(vc);
      }
      tk.staves[0].addBar(br);
    }
  }
  scr.finish(new Settings());
  const{notes,tempos,times,handler}=recordHandler();
  const gen=new midi.MidiFileGenerator(scr,new Settings(),handler); gen.generate();

  const occs:PlaybackOccurrence[]=[]; let oid=0;
  for(const e of gen.tickLookup.masterBars){
    occs.push({
      occurrenceId:oid,
      barSourceKey:e.masterBar.index,
      startTick:String(e.start),
      tempoBpm:tempoAt(tempos,e.start,bt),
    }); oid++;
  }

  const evts:PlaybackMidiEvent[]=[];
  for(const t of tempos)evts.push({tick:String(t.tick),type:"tempo",channel:0,key:0,velocity:0,length:null,tempoBpm:t.tempo,timeSigNumerator:null,timeSigDenominator:null,occurrenceId:null});
  for(const ts of times)evts.push({tick:String(ts.tick),type:"timeSig",channel:0,key:0,velocity:0,length:null,tempoBpm:null,timeSigNumerator:ts.numerator,timeSigDenominator:ts.denominator,occurrenceId:null});
  for(const r of notes){
    let noid:number|null=null;
    for(const o of occs){
      const os=Number(o.startTick);
      const oe=os+barDur(scr.masterBars,o.barSourceKey);
      if(r.start>=os&&r.start<oe){noid=o.occurrenceId;break;}
    }
    evts.push({tick:String(r.start),type:"noteOn",channel:r.channel,key:r.key,velocity:r.velocity,length:String(r.length),tempoBpm:null,timeSigNumerator:null,timeSigDenominator:null,occurrenceId:noid});
  }

  const tgs:TrainingTarget[]=[]; let ucnt=0;
  const it0=isr.tracks[0];
  if(!it0)return{midiEvents:evts,occurrences:occs,targets:[],unresolvedCount:0};

  const ibm=new Map<string,{idx:number;dur:number;notes:{sn:number;fr:number;midi:number;tie:boolean;tech:string[]}[]}>();
  for(const m of it0.measures){
    for(let vi=0;vi<m.voices.length;vi++){
      for(let bi=0;bi<m.voices[vi].length;bi++){
        ibm.set(m.index+"/"+vi+"/"+bi,{
          idx:m.voices[vi][bi].index,
          dur:m.voices[vi][bi].duration,
          notes:m.voices[vi][bi].notes.map(n=>({sn:n.stringNumber,fr:n.fret,midi:n.midi,tie:n.isTieDestination,tech:n.techniques})),
        });
      }
    }
  }

  const abm=new Map<string,{bi:number;vi:number;bei:number;ans:model.Note[]}>();
  for(const at of scr.tracks){
    for(let bi=0;bi<at.staves[0].bars.length;bi++){
      const bar=at.staves[0].bars[bi];
      for(let vi=0;vi<bar.voices.length;vi++){
        for(let bei=0;bei<bar.voices[vi].beats.length;bei++){
          abm.set(bi+"/"+vi+"/"+bei,{
            bi,vi,bei,
            ans:bar.voices[vi].beats[bei].notes.slice(),
          });
        }
      }
    }
  }

  for(let ri=0;ri<notes.length;ri++){
    const r=notes[ri];
    let oidx:number|null=null; let sbi:number|null=null;
    for(let oi=0;oi<occs.length;oi++){
      const o=occs[oi]; const os=Number(o.startTick);
      const oe=os+barDur(scr.masterBars,o.barSourceKey);
      if(r.start>=os&&r.start<oe){oidx=oi;sbi=o.barSourceKey;break;}
    }
    if(sbi===null||oidx===null){ucnt++;continue;}

    let mbk:string|null=null; let ans:model.Note[]|null=null;
    for(const [beatKey,bd] of abm.entries()){
      if(bd.bi===sbi){
        for(const an of bd.ans){if(an.realValue===r.key){mbk=beatKey;ans=bd.ans;break}}
        if(mbk)break;
      }
    }
    if(!mbk||!ans){ucnt++;continue;}

    const [bi,vi,bei]=mbk.split("/").map(Number);
    const ie=ibm.get(bi+"/"+vi+"/"+bei);
    if(!ie){ucnt++;continue;}

    const skn=ans.filter(an=>an.realValue===r.key);
    if(skn.length===0){ucnt++;continue;}

    let grading:TrainingTarget["grading"]="singleNote"; let er:string|undefined;
    if(skn.length>1){
      const ds=new Set(skn.map(an=>an.string));
      grading="identityUnresolved";
      er=ds.size>1?("unison key="+r.key+" strings["+[...ds].join(",")+"]"):("ambiguous "+skn.length+" notes key="+r.key);
      ucnt++;
    }

    const an0=skn[0];
    const mnIdx=ie.notes.findIndex((n:any)=>n.fr===an0.fret&&n.midi===an0.realValue);
    const mn=mnIdx>=0?ie.notes[mnIdx]:ie.notes[0];
    if(!mn){ucnt++;continue;}

    tgs.push({
      id:"t"+r.track+"-o"+oidx+"-k"+r.key,
      occurrenceId:occs[oidx].occurrenceId,
      beatSourceKey:[it0.index,0,bi,vi,bei],
      noteSourceKey:[it0.index,0,bi,vi,bei,mnIdx>=0?mnIdx:0],
      stringNumber:mn.sn,
      fret:mn.fr,
      soundingMidi:r.key,
      startTick:String(r.start),
      durationTicks:String(r.length),
      techniques:mn.tech??[],
      grading,
      exclusionReason:er,
    });
  }

  return{midiEvents:evts,occurrences:occs,targets:tgs,unresolvedCount:ucnt};
}
