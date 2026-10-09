import {spawn} from 'node:child_process';
// One short-lived process per uncached selection. It validates its runtime
// while Wallpaper Engine prepares the scene, then waits for the exact image.
export class PreparedThemeAction{
  constructor(exe,args,{timeoutMs=60000}={}){
    this.sent=false;this.output='';this.closed=false;
    this.child=spawn(exe,args,{windowsHide:true,shell:false});
    this.done=new Promise(resolve=>{
      const finish=result=>{if(this.closed)return;this.closed=true;clearTimeout(this.timer);resolve(result)};
      this.child.once('error',error=>finish({error}));
      this.child.once('close',code=>finish({code}));
      this.child.stdin.on('error',error=>{this.inputError=error});
      for(const stream of [this.child.stdout,this.child.stderr])stream.on('data',data=>{if(this.output.length<1024*1024)this.output+=data.toString()});
      this.timer=setTimeout(()=>{this.inputError=new Error('主题准备超时');this.child.kill()},timeoutMs);
    });
  }
  async apply(request){
    if(this.sent)throw new Error('Theme request already sent');this.sent=true;
    const line=JSON.stringify(request);if(line.length>16384){await this.cancel();throw new Error('Theme request too large')}
    const acceptedInput=!this.closed;
    if(acceptedInput)this.child.stdin.end(line+'\n');
    const result=await this.done;
    if(result.error)throw result.error;
    if(this.inputError)throw this.inputError;
    if(!acceptedInput)throw new Error(this.output.trim().slice(-1000)||'主题准备程序提前结束');
    if(result.code!==0)throw new Error(this.output.trim().slice(-1000)||'主题应用失败');
  }
  async cancel(){if(!this.closed){this.child.kill();await this.done}}
}
