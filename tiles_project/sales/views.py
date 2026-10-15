from django.shortcuts import render

def dashboard(request):
    context = {
    "total_sales": 125,
    "total_products": 350,
    "total_clients": 87,
    "total_revenue": "125 000 000",
    }


    return render(request, "sales/dashboard.html", context)
