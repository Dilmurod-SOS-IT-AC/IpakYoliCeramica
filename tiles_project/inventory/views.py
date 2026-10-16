from django.shortcuts import render

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import Shipment, StockMovement

@login_required
@require_GET

def inventory_summary(request):
    data = {
        "shipment_count" : Shipment.objects.count(),
        "movements_count" : StockMovement.objects.count()
    }

    return JsonResponse(data)