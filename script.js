let ctx = document.getElementById('myChart').getContext('2d');

let path_data = pathsJson;

let pathsLabels = path_data.paths_general.map(x => x.common_name + ' | ' + x.old_speech_name);

var pathsDatasets = [
    {
        backgroundColor: [],
        data: [
            1,
            1,
            1
        ],
        ids: [

        ],
        borderColor: 'black',
        borderWidht: 2,
        hoverBorderWidth: 4,
        hoverBorderColor: "#ffcc66"
    },
    {
        backgroundColor: [, , ,],

        data: [
            0, 0, 0,
            1, 1, 1, 1, 1, 1, 1, 1, 1
        ],
        ids: [
            '', '', '',
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
        ids: [
            '', '', '', '', '', '', '', '', '', '', '', '',
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
    if (currentIndex > limits[currentLimit]) {
        currentIndex = 0;
        currentLimit++;
    }
    pathsDatasets[currentLimit].backgroundColor.push(element.color)
    pathsDatasets[currentLimit].ids.push(element.path_id)

    currentIndex++;
});
//LOAD COLORS

var myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
        datasets: pathsDatasets.reverse(),
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
                    return data.labels[tooltipItems.index];
                }
            }
        },

        onClick: showPathCard,

        animation: {
            animateRotate: true,
            animateScale: true
        }
    }

});

function showPathCard(event, array) {
    let datasetIndex = array[0]._datasetIndex;
    let objectIndex = array[0]._index;

    let pathId = pathsDatasets[datasetIndex].ids[objectIndex];

    console.log(pathId)

    //Building
    let path_general = path_data.paths_general.find(x => x.id === pathId)
    let path_appaerance = path_data.paths_appaerance.find(x => x.path_id === pathId);
    let pathName = path_general.common_name + " | " + path_general.old_speech_name;

    let path_category = path_data.paths_categories.find(x => x.id === path_general.category_id)

    let pathCategoryName = path_category.common_name + " | " + path_category.old_speech_name;

    let path_content = path_data.paths_content.find(x => x.id === pathId)

    let pathContent = path_content.content

    //Display the card
    $("#path_card_container").css("display", "block");

    $('#path_card').css('background-color', convertHex(path_appaerance.color, 30))

    $("#path_name").text(pathName)
    $("#path_category").text(pathCategoryName)
    $("#path_content").text(pathContent)

    var image = new Image()

    image.onload = function () {
        $("#path_image").attr("src", "img/" + pathId + ".png")
    }

    image.onerror = function () {
        $("#path_image").attr("src", "img/path_default.png")
    }

    image.src = "img/" + pathId + ".png"
}

function convertHex(hex, opacity) {
    // Don't make the black a gray
    if (hex === "#1a1a1a") return convertHex('#3c3f42', 80)

    hex = hex.replace('#', '');
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);

    result = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity / 100 + ')';
    return result;
}