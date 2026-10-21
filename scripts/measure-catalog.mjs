import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createFixtureProject } from '../dist/test/helpers.js';
const fixture=createFixtureProject();
async function measure(mode) {
 const client=new Client({name:'measure',version:'1'});
 const transport=new StdioClientTransport({command:process.execPath,args:['dist/src/index.js'],env:{...process.env,GAMEMAKER_PROJECT:fixture.projectFile,GM_MCP_TOOL_MODE:mode},stderr:'pipe'});
 try {await client.connect(transport);const list=await client.listTools();const result={tools:list.tools.length,bytes:Buffer.byteLength(JSON.stringify(list))};if(mode==='compact'){await client.callTool({name:'gm_tools_enable',arguments:{names:['gm_project_info']}}); const info=await client.callTool({name:'gm_project_info',arguments:{}});if(info.isError)throw Error('project info failed');}return result;}finally{await client.close();}
}
console.log(JSON.stringify({full:await measure('full'),compact:await measure('compact')},null,2));

