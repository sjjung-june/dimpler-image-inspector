const loginForm = document.querySelector(".login-form");
const input = document.querySelector(".file-input");
const dropbox = document.querySelector("#dropbox");
const image_btn = document.querySelector(".image-submit");
const webcam_btn = document.querySelector(".webcam-submit");
const canvas = document.querySelector(".canvas");
const canvas_zoom = document.querySelector(".canvas_zoom");
const canvas_profile = document.querySelector(".canvas_profile");
const root = document.documentElement;
const SCALE_IMAGE = 0.5;
const ctx = canvas.getContext("2d");
const ctx_zoom = canvas_zoom.getContext("2d");
const ctx_profile = canvas_profile.getContext("2d");
const img = document.createElement("img");

reconstruct = false;
canvas_zoom.height = 150;
canvas_zoom.width = 150;

const mouse = {
  move_x: 0,
  move_y: 0,
  down_x: 0,
  up_x: 0,
  down_y: 0,
  up_y: 0,
  drag: false,
};

function handleLoginSubmit(event) {
  event.preventDefault();

  if (input.files.length !== 0) {
    img.src = window.URL.createObjectURL(input.files[0]);
  } else {
    //img.crossOrigin = "Anonymous";
    //img.src = "https://www.akamai.com/content/dam/site/im-demo/perceptual-standard.jpg?imbypass=true";
    alert("이미지를 선택해주세요");
  }

  img.addEventListener(
    "load",
    () => {
      canvas.height = img.height;
      canvas.width = img.width;

      ctx.drawImage(img, 0, 0);
      imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      canvas.height = img.height * SCALE_IMAGE;
      canvas.width = img.width * SCALE_IMAGE;

      root.style.setProperty("--canvas-width", `${canvas.width - 160}px`);
      root.style.setProperty("--canvas-height", `${canvas.height - 160}px`);
      bounds = canvas.getBoundingClientRect();
      canvas.classList.add("loaded");
      update();
    },
    { once: true }
  );

  canvas.addEventListener("mousedown", mousedownHandler);
  canvas.addEventListener("mouseup", mouseupHandler);
  canvas.addEventListener("mousemove", mousemoveHandler);
}

function mousedownHandler(event) {
  mouse.down_x = event.pageX - bounds.left;
  mouse.down_y = event.pageY - bounds.top;

  mouse.drag = true;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  //ctx.drawImage(img, 0, 0);

  ctx.drawImage(img, 0, 0, img.width * SCALE_IMAGE, img.height * SCALE_IMAGE);

  ctx.beginPath();
  ctx.moveTo(mouse.down_x, mouse.down_y);
}

function mouseupHandler(event) {
  mouse.drag = false;
  mouse.up_x = event.pageX - bounds.left;
  mouse.up_y = event.pageY - bounds.top;
  ctx.lineTo(mouse.up_x, mouse.up_y);
  ctx.stroke();

  const pts = getProfile(
    imgData,
    mouse.down_x,
    mouse.down_y,
    mouse.up_x,
    mouse.up_y
  );

  label = [];
  for (var i = 0; i < pts.length; i++) {
    label.push(i);
  }

  const data = {
    labels: label,

    datasets: [
      {
        label: "Image Profile",
        //backgroundColor: "rgb(255, 99, 132)",
        //borderColor: "rgb(255, 99, 132)",
        data: pts,
        pointRadius: 0.5,
        tension: 0.5,
      },
    ],
  };

  let peak_pos = findPeak(pts);

  let peak_height = Array(pts.length);
  peak_pos.forEach((element) => {
    peak_height[element] = pts[element];
  });

  idxs = [];
  for (let idx = 0; idx < pts.length + 1; idx++) {
    idxs.push(idx);
  }

  const peakFilter = selectPeak(
    peak_pos,
    peak_height.filter((val) => val),
    5
  );

  peak_pos = peak_pos.filter((val) => val).filter((d, idx) => peakFilter[idx]);

  peak_height = peak_height
    .filter((val) => val)
    .filter((d, idx) => peakFilter[idx]);

  peak_height = Array(pts.length);
  peak_pos.forEach((element) => {
    peak_height[element] = pts[element];
  });

  let peak_count = peak_pos.length;

  canvas_profile.width = img.width * SCALE_IMAGE;

  if (!reconstruct) {
    drawChart(canvas_profile, pts, peak_height, idxs, peak_count);
    reconstruct = true;
  } else {
    myChart.destroy();
    drawChart(canvas_profile, pts, peak_height, idxs, peak_count);
  }
  ctx.fillStyle = "red";
  ctx.fillRect(mouse.up_x - 2, mouse.up_y - 2, 4, 4);
}

function mousemoveHandler(event) {
  mouse.move_x = event.pageX - bounds.left;
  mouse.move_y = event.pageY - bounds.top;

  canvas_zoom.classList.add("active");
  //Zoom Image Moving Lines
  //root.style.setProperty("--mouse-x", `${mouse.move_x - 50}px`);
  //root.style.setProperty("--mouse-y", `${mouse.move_y - 50}px`);

  ctx_zoom.drawImage(
    img,
    mouse.move_x / SCALE_IMAGE - 37.5,
    mouse.move_y / SCALE_IMAGE - 37.5,
    75,
    75,
    0,
    0,
    150,
    150
  );
  ctx_zoom.beginPath();
  ctx_zoom.moveTo(55, 75);
  ctx_zoom.lineTo(95, 75);
  ctx_zoom.stroke();

  ctx_zoom.beginPath();
  ctx_zoom.moveTo(75, 55);
  ctx_zoom.lineTo(75, 95);
  ctx_zoom.stroke();

  if (mouse.drag === true) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, img.width * SCALE_IMAGE, img.height * SCALE_IMAGE);
    ctx.beginPath();
    ctx.moveTo(mouse.down_x, mouse.down_y);
    ctx.lineTo(mouse.move_x, mouse.move_y);
    ctx.stroke();
    ctx.fillStyle = "red";
    ctx.fillRect(mouse.down_x - 2, mouse.down_y - 2, 4, 4);
  }
}

function getProfile(imgData, x1, y1, x2, y2) {
  const pixelList = [];

  var x = x1 / SCALE_IMAGE;
  var y = y1 / SCALE_IMAGE;
  const xx = x2 / SCALE_IMAGE;
  const yy = y2 / SCALE_IMAGE;
  const dx = Math.abs(xx - x);
  const sx = x < xx ? 1 : -1;
  const dy = -Math.abs(yy - y);
  const sy = y1 < y2 ? 1 : -1;

  var err = dx + dy;
  var e2;
  var end = false;

  while (!end) {
    pixelList.push(getPixel(imgData, x, y));

    if (x === xx && y === yy) {
      end = true;
    } else {
      e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  return pixelList;
}

function getPixel(imgData, x, y) {
  const idx = (x + y * imgData.width) * 4;
  return Math.ceil(
    (imgData.data[idx] + imgData.data[idx + 1] + imgData.data[idx + 2]) / 3
  );
}

function findPeak(profileData) {
  const mid_points = [];
  const left_edges = [];
  const right_edges = [];

  let m = 0;
  let i = 1;
  let i_max = profileData.length - 1;

  while (i < i_max) {
    if (profileData[i - 1] < profileData[i]) {
      let i_ahead = i + 1;
      while (i_ahead < i_max && profileData[i_ahead] === profileData[i]) {
        i_ahead += 1;
      }

      if (profileData[i_ahead] < profileData[i]) {
        left_edges.push(i);
        right_edges.push(i_ahead - 1);
        mid_points.push(Math.trunc((i + i_ahead - 1) / 2));
        m += 1;
        i = i_ahead;
      }
    }
    i += 1;
  }

  return mid_points;
}

function selectPeak(peak_pos, peak_height, distance) {
  let decor = (v, i) => [v, i];
  let undecor = (a) => a[1];
  let argsort = (arr) => arr.map(decor).sort().map(undecor);

  let keep = Array(peak_pos.length).fill(true);

  const priority = argsort(peak_height).slice(0, peak_pos.length);

  for (let i = peak_pos.length - 1; i > -1; i--) {
    j = priority[i];
    if (keep[j] === false) {
      continue;
    }

    k = j - 1;

    while (0 <= k && peak_pos[j] - peak_pos[k] < distance) {
      keep[k] = false;
      k -= 1;
    }

    k = j + 1;
    while (k < peak_pos.length && peak_pos[k] - peak_pos[j] < distance) {
      keep[k] = false;
      k += 1;
    }
  }
  return keep;
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, img.width * SCALE_IMAGE, img.height * SCALE_IMAGE);
}

function drawChart(canvas_profile, pts, peak_height, idxs, peak_count) {
  myChart = new Chart(canvas_profile, {
    data: {
      datasets: [
        {
          type: "line",
          label: "Line Profile",
          data: pts,
          borderColor: "rgb(0, 0, 0)",
          backgroundColor: "rgb(0, 0, 0)",
          borderWidth: 0.5,

          tension: 0.1,
          pointRadius: 0,
          //pointRadius: 0.5,
        },
        {
          type: "scatter",
          label: "Peak",
          data: peak_height,
          borderColor: "rgb(255, 100, 100)",
          backgroundColor: "rgba(255, 100, 100, 0.1)",
        },
        {
          type: "scatter",
          label: `Peak Count = ${peak_count}`,
          data: "",
          borderColor: "rgb(132, 99, 255)",
          backgroundColor: "rgba(132, 99, 255, 0.1)",
        },
      ],
      labels: idxs,
    },
    options: {
      responsive: false,
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
      },
      onClick: function (event, point) {
        console.log(point);
        if (point.length > 0) {
          peak_height[point[0].index] = undefined;
          if (point[0].datasetIndex === 1 || point.length === 2) {
            peak_count--;
            myChart.data.datasets[2].label = `Peak Count : ${peak_count}`;
          }

          myChart.update();
        }
      },
    },
  });
}

function disableWebcam() {
  image_btn.disabled = false;
  webcam_btn.disabled = true;
}

function handleMouseEnter() {
  canvas_zoom.classList.toggle("canvas_zoom_pos");
  canvas_zoom.classList.toggle("canvas_zoom_pos_alt");
}

//loginForm.addEventListener("submit", handleLoginSubmit);
input.addEventListener("change", handleLoginSubmit);
canvas_zoom.addEventListener("mouseenter", handleMouseEnter);
