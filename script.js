let ctx = document.getElementById('myChart').getContext('2d');

let path_data = pathsJson;

let pLight_appr = path_data.paths_appaerance.find(x => x.path_id === "path_of_light")
let pDark_appr = path_data.paths_appaerance.find(x => x.path_id === "path_of_dark")
let pShadow_appr = path_data.paths_appaerance.find(x => x.path_id == "path_of_shadow")

let pLight_general = path_data.paths_general.find(x => x.id = "path_of_light")
let pDark_general = path_data.paths_general.find(x => x.id = "path_of_dark")
let pShadow_general = path_data.paths_general.find(x => x.id = "path_of_shadow")

let pathsLabels = path_data.paths_general.map(x => x.common_name + ' | ' + x.old_speech_name);

var pathsDatasets = [
{
    backgroundColor: [],
    data: [
        1,
        1,
        1
    ],
    borderColor: 'black',
    borderWidht: 2,
    hoverBorderWidth: 4,
    hoverBorderColor: "#ffcc66"
}, 
{
    backgroundColor: [,,,],

    data: [
        0, 0, 0,
        1, 1, 1,  1, 1, 1,  1, 1, 1
    ],
    borderColor: 'black',
    borderWidht: 2,
    hoverBorderWidth: 4,
    hoverBorderColor: "#ffcc66"
},
            {
                backgroundColor: [, , , , , , , , , , , ,
                ],
                data: [
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                    1, 1, 1, 1, 1, 1, 1, 1, 1,
                    1, 1, 1, 1, 1, 1, 1, 1, 1,
                    1, 1, 1, 1, 1, 1, 1, 1, 1
                ],
                borderColor: 'black',
                borderWidht: 2,
                hoverBorderWidth: 4,
                hoverBorderColor: "#ffcc66"
            },

]

var currentIndex = 0
var currentLimit = 0
let limits = [2, 8, 26]

//LOAD COLORS
path_data.paths_appaerance.forEach(element => {
    if(currentIndex > limits[currentLimit]) {
        currentIndex = 0;
        currentLimit++;
    }
        pathsDatasets[currentLimit].backgroundColor.push(element.color)

    currentIndex++;
});
//LOAD COLORS

var myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
        datasets : pathsDatasets.reverse(),
        labels: pathsLabels
    },

    options: {
        responsive: true,
        maintainAspeectRatio: true,

        cutoutPercentage: 5,

        legend: {
            display: false
        },

        tooltips: {
            titleFontSize: 24,
            callbacks: {
                label: function (tooltipItems, data) {  
                    console.log(data)
                    return data.labels[tooltipItems.index];
                }
            }
        }
    }

});