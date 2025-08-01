// Test Dropbox URL handling with JavaScript (same logic as frontend)

const testDropboxUrl = (originalUrl) => {
  console.log("Original URL:", originalUrl);
  
  if (originalUrl.includes('dropbox.com')) {
    let dropboxUrl = originalUrl;
    
    // Replace various Dropbox URL patterns with raw=1
    if (dropboxUrl.includes('&dl=0')) {
      dropboxUrl = dropboxUrl.replace(/&dl=0/g, '&raw=1');
    } else if (dropboxUrl.includes('?dl=0')) {
      dropboxUrl = dropboxUrl.replace(/\?dl=0/g, '?raw=1');
    } else if (dropboxUrl.includes('&dl=1')) {
      dropboxUrl = dropboxUrl.replace(/&dl=1/g, '&raw=1');
    } else if (dropboxUrl.includes('?dl=1')) {
      dropboxUrl = dropboxUrl.replace(/\?dl=1/g, '?raw=1');
    } else if (!dropboxUrl.includes('raw=1')) {
      // If no dl parameter, add raw=1
      const separator = dropboxUrl.includes('?') ? '&' : '?';
      dropboxUrl = `${dropboxUrl}${separator}raw=1`;
    }
    
    console.log("Converted URL:", dropboxUrl);
    
    if (dropboxUrl.includes('&raw=1') || dropboxUrl.includes('?raw=1')) {
      console.log("✅ Dropbox URL conversion successful!");
      return true;
    } else {
      console.log("❌ Dropbox URL conversion failed!");
      return false;
    }
  }
  
  return false;
};

// Test the exact URL from the user
const testUrl = "https://www.dropbox.com/scl/fi/o2jbtoi790kogxbgo37uj/ANORA.mkv?rlkey=ny8advgttu4rrvb4diz7wywvl&st=glgmxbgi&dl=0";

console.log("Testing Dropbox URL conversion...");
console.log("");

const result = testDropboxUrl(testUrl);

// Test additional variations
console.log("");
console.log("Testing additional variations:");

const testCases = [
  "https://www.dropbox.com/scl/fi/test.mkv?dl=0",
  "https://www.dropbox.com/scl/fi/test.mkv&dl=1",
  "https://www.dropbox.com/scl/fi/test.mkv?dl=1",
  "https://www.dropbox.com/scl/fi/test.mkv",
  "https://www.dropbox.com/scl/fi/test.mkv?param=value&dl=0",
  "https://www.dropbox.com/scl/fi/test.mkv?param=value&dl=1"
];

testCases.forEach((url, index) => {
  console.log(`\nTest case ${index + 1}:`);
  testDropboxUrl(url);
});

console.log("");
console.log("All tests completed!"); 