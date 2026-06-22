import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: [],
        message: 'hi',
        context: 'visitor'
      })
    });
    
    const text = await res.text();
    console.log("Response from 127.0.0.1:");
    console.log(text);
  } catch(e) {
    console.error("127.0.0.1 failed", e);
  }
}

test();
