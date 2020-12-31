import React, { useEffect } from 'react';

// eslint-disable-next-line no-undef
const p = new SimplePeer({
  // eslint-disable-next-line no-restricted-globals
  initiator: location.hash === "#1",
  trickle: false,
  config: { iceServers: [] },
});

p.on("error", (err) => console.log("error", err));

p.on("signal", (data) => {
  console.log("SIGNAL", JSON.stringify(data));
  document.querySelector("#outgoing").textContent = JSON.stringify(data);
});

p.on("connect", () => {
  console.log("CONNECT");
  p.send("whatever" + Math.random());
});

p.on("data", (data) => {
  console.log("data: " + data);
});

function Bootstrapper() {
    useEffect(() => { 
        document.querySelector("form").addEventListener("submit", (ev) => {
            ev.preventDefault();
            p.signal(JSON.parse(document.querySelector("#incoming").value));
          });
    }, []);


  return (
    <div className="App">
      <form>
        <textarea id="incoming"></textarea>
        <button type="submit">submit</button>
      </form>
      <pre id="outgoing"></pre>
    </div>
  );
}

export default Bootstrapper;
