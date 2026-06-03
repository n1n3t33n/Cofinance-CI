from django.shortcuts import render


def demo_chat(request):
    """Page de démonstration du chat en temps réel."""
    return render(request, 'chat/demo.html')