const { cpSync, existsSync } = require('fs');
const { join } = require('path');

module.exports = async function(context) {
  const resourcesDir = context.appOutDir + '/resources';
  
  const serverSrc = join(__dirname, '..', 'server');
  const serverDst = join(resourcesDir, 'server');
  
  if (existsSync(serverSrc)) {
    console.log('Copying server to resources...');
    cpSync(serverSrc, serverDst, { recursive: true, filter: (src) => !src.includes('.git') && !src.includes('chatter.db') && !src.endsWith('.env') });
    console.log('Server copied.');
  }

  const nodeSrc = join(__dirname, '..', 'tools', 'node.exe');
  const nodeDst = join(resourcesDir, 'node.exe');
  
  if (existsSync(nodeSrc)) {
    console.log('Copying node.exe to resources...');
    cpSync(nodeSrc, nodeDst);
    console.log('node.exe copied.');
  }
};
