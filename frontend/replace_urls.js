import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const componentsDir = path.join(__dirname, 'src', 'components');
const filesToUpdate = [
  path.join(componentsDir, 'Planner.jsx'),
  path.join(componentsDir, 'LearningEngine.jsx'),
  path.join(componentsDir, 'Heatmap.jsx'),
  path.join(componentsDir, 'Dashboard.jsx'),
  path.join(componentsDir, 'CommandCenter.jsx'),
  path.join(componentsDir, 'Analytics.jsx')
];

filesToUpdate.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace all 'http://localhost:8000/api' or "http://localhost:8000/api" with the environment variable
    // We replace the hardcoded string with a dynamic template literal or fallback expression.
    // e.g. 'http://localhost:8000' -> (import.meta.env.VITE_API_URL || 'http://localhost:8000')
    
    const target = 'http://localhost:8000';
    const replacement = '${import.meta.env.VITE_API_URL || "http://localhost:8000"}';
    
    // Convert regular string URLs to template literals if they are inside standard quotes
    // For example:
    // fetch('http://localhost:8000/api/options')
    // becomes:
    // fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/options`)
    
    // Let's replace 'http://localhost:8000' with the template syntax
    // We handle single quotes, double quotes, and template literals
    
    let updated = false;
    
    // Replace single quotes
    const singleQuoteRegex = /'http:\/\/localhost:8000([^']*)'/g;
    if (singleQuoteRegex.test(content)) {
      content = content.replace(singleQuoteRegex, '`${import.meta.env.VITE_API_URL || "http://localhost:8000"}$1`');
      updated = true;
    }
    
    // Replace double quotes
    const doubleQuoteRegex = /"http:\/\/localhost:8000([^"]*)"/g;
    if (doubleQuoteRegex.test(content)) {
      content = content.replace(doubleQuoteRegex, '`${import.meta.env.VITE_API_URL || "http://localhost:8000"}$1`');
      updated = true;
    }

    // Replace template backticks
    const backtickRegex = /`http:\/\/localhost:8000([^`]*)`/g;
    if (backtickRegex.test(content)) {
      content = content.replace(backtickRegex, '`${import.meta.env.VITE_API_URL || "http://localhost:8000"}$1`');
      updated = true;
    }
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated URLs in: ${path.basename(filePath)}`);
    } else {
      console.log(`No URLs to update in: ${path.basename(filePath)}`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
